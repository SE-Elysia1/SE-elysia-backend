import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { orders, users, pcs, foodMenu, transactions } from "../database/schema";
import { eq } from "drizzle-orm";

export const orderRoutes = new Elysia({ prefix: "/api" })
  .get(
    "/admin/orders",
    async ({ query, set }) => {
      const { requesterId } = query;
      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(requesterId)))
          .get();
        if (!admin || admin.role.toLowerCase() !== "admin") {
          set.status = 403;
          return {
            success: false,
            message: `Unauthorized Action!`,
          };
        }

        const rawOrders = await db
          .select({
            id: orders.id,
            customer: users.username,
            station: pcs.pcNumber,
            itemsJson: orders.items,
            totalPrice: orders.totalPrice,
            status: orders.status,
            time: orders.createdAt,
          })
          .from(orders)
          .innerJoin(users, eq(orders.userId, users.id))
          .innerJoin(pcs, eq(orders.pcId, pcs.id))
          .where(eq(orders.status, "pending"))
          .all();

        const allFood = await db.select().from(foodMenu).all();
        const foodMap = new Map(allFood.map((f) => [f.id, f.name]));

        return rawOrders.map((order) => {
          const cart = JSON.parse(order.itemsJson);
          const itemStrings = cart.map((item: any) => {
            const foodName = foodMap.get(item.foodId) || "Unknown Item";
            return `${item.qty}x ${foodName}`;
          });

          return {
            id: order.id,
            customer: order.customer,
            station: order.station,
            food: itemStrings.join(", "),
            totalPrice: order.totalPrice,
            status: order.status,
            time: order.time,
          };
        });
      } catch (err) {
        set.status = 500;
        return {
          success: false,
          message: `Backend Server error ${err}`,
        };
      }
    },
    {
      query: t.Object({ requesterId: t.String() }),
      response: {
        200: t.Array(
          t.Object({
            id: t.Number(),
            customer: t.String(),
            station: t.Any(),
            food: t.String(),
            totalPrice: t.Number(),
            status: t.Union([
              t.Literal("pending"),
              t.Literal("done"),
              t.Null(),
            ]),
            time: t.Any(),
          }),
        ),
        403: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        500: t.Any(),
      },
    },
  )
  .post(
    "/order",
    async ({ body, set }) => {
      const { userId, cart, pcId } = body;
      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .get();
        if (!user) {
          set.status = 404;
          return { success: false, message: "User is not found" };
        }

        let totalPrice = 0;
        for (const item of cart) {
          const food = await db
            .select()
            .from(foodMenu)
            .where(eq(foodMenu.id, item.foodId))
            .get();
          if (!food) {
            set.status = 404;
            return {
              success: false,
              message: `Food ID ${item.foodId} not found in menu!`,
            };
          }
          totalPrice += food.price * item.qty;
        }

        if (user.balance < totalPrice) {
          set.status = 400;
          return {
            success: false,
            message: `User ${user.username} has insufficient balance`,
          };
        }

        await db.transaction(async (tx) => {
          await tx.insert(orders).values({
            userId,
            pcId,
            items: JSON.stringify(cart),
            totalPrice,
            createdAt: Date.now(),
          });
          await tx
            .update(users)
            .set({ balance: user.balance - totalPrice })
            .where(eq(users.id, userId));
        });

        return { success: true, message: "Order has been placed" };
      } catch (err) {
        console.log(err);
        set.status = 500;
        return { success: false, message: `Backend error: ${err}` };
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        pcId: t.Number(),
        cart: t.Array(t.Object({ foodId: t.Number(), qty: t.Number() })),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/admin/orders/complete",
    async ({ body, query, set }) => {
      const { OrderID } = body;
      const { requesterId } = query;
      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(requesterId)))
          .get();
        if (!admin || admin.role.toLowerCase() !== "admin") {
          set.status = 403;
          return {
            success: false,
            message: "Forbidden: Admin access required",
          };
        }

        const targetOrder = await db
          .select()
          .from(orders)
          .where(eq(orders.id, OrderID))
          .get();

        if (!targetOrder) {
          set.status = 404;
          return { success: false, message: "Order not found" };
        }

        await db.transaction(async (tx) => {
          await tx
            .update(orders)
            .set({ status: "done" })
            .where(eq(orders.id, OrderID));

          await tx.insert(transactions).values({
            userId: targetOrder.userId,
            type: "food",
            coins: -targetOrder.totalPrice,
            description: `Food Order: ${targetOrder.id}`,
            pcId: targetOrder.pcId,
            createdAt: Date.now(),
          });
        });

        return { success: true, message: `Order ${OrderID} marked as done` };
      } catch (err) {
        console.log(err);
        set.status = 500;
        return { success: false, message: `Backend error ${err}` };
      }
    },
    {
      query: t.Object({ requesterId: t.String() }),
      body: t.Object({ OrderID: t.Number() }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/admin/orders/:id",
    async ({ params, query, set }) => {
      const orderId = Number(params.id);
      const { requesterId } = query;
      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(requesterId)))
          .get();
        if (!admin || admin.role.toLowerCase() !== "admin") {
          set.status = 403;
          return {
            success: false,
            message: "Forbidden: Admin access required",
          };
        }

        const targetOrder = await db
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .get();

        if (!targetOrder) {
          set.status = 404;
          return {
            success: false,
            message: `Order ${orderId} cannot be found`,
          };
        }

        await db.delete(orders).where(eq(orders.id, orderId));
        return { success: true, message: `Order ${orderId} has been deleted` };
      } catch (err) {
        set.status = 500;
        console.log(err);
        return { success: false, message: `Backend error ${err}` };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ requesterId: t.String() }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  );
