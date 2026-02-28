import cors from "@elysiajs/cors";
import { Elysia, t } from "elysia";
//uncomment this to seed admin account and pc database
import { orders, pcs } from "./database/schema";
import { swagger } from "@elysiajs/swagger";
import { db } from "./database/db";
import { asc } from "drizzle-orm";
import { users } from "./database/schema";
import { eq } from "drizzle-orm";
import { foodMenu } from "./database/schema";
import { openapi, fromTypes } from "@elysiajs/openapi";
import os from "os";
import { GelInt53 } from "drizzle-orm/gel-core";
//uncomment this to seed database
// import { seed } from "./database/seed";
// seed()

if (os.platform() === "win32") {
  console.log("Here's a nickel, Get yourself a real OS and stop using windows");
}

const PLAN_HOURS: Record<number, number> = {
  1: 1, // 1 hour
  2: 5, // 5 hours
  3: 10, // 10 hours
};
const app = new Elysia()
  .get("/", () => "Elysia is replying from the Elysian Realm") //test
  .use(
    openapi({
      references: fromTypes(),
    }),
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "SE-Elysia API DOCS",
          version: "2.0.0",
        },
      },
    }),
  )
  .use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:8080",
      ],
    }),
  )
  .get(
    "/api/pcs",
    async ({ set }) => {
      try {
        const allPcs = await db.select().from(pcs).orderBy(asc(pcs.pcNumber));
        return {
          success: true,
          data: allPcs,
        };
      } catch (error) {
        console.log("Failed to get PC status");
        set.status = 500;
        return {
          success: false,
          message: "Failed to get PC status",
        };
      }
    },
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Optional(t.Array(t.Any())),
        message: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/api/menus",
    async ({ set }) => {
      try {
        const menus = await db
          .select()
          .from(foodMenu)
          .orderBy(asc(foodMenu.price));
        return {
          success: true,
          data: menus,
        };
      } catch (error) {
        console.log("Failed to get menus");
        set.status = 500;
        return {
          success: false,
          message: "Failed to get Menu items",
        };
      }
    },
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Optional(t.Array(t.Any())),
        message: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/api/plans",
    async ({ set }) => {
      return {
        data: [
          { id: 1, hours: 1, price: 4, name: "1 Hour Quick Play" },
          { id: 2, hours: 5, price: 18, name: "5 Hour Marathon" },
          { id: 3, hours: 10, price: 35, name: "10 Hour All-Nighter" },
        ],
      };
    },
    {
      response: t.Object({
        data: t.Array(
          t.Object({
            id: t.Number(),
            hours: t.Number(),
            price: t.Number(),
            name: t.String(),
          }),
        ),
      }),
    },
  )
  .get(
    "/api/admin/orders",
    async () => {
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

      const formattedOrders = rawOrders.map((order) => {
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

      return formattedOrders;
    },
    {
      response: t.Array(
        t.Object({
          id: t.Number(),
          customer: t.String(),
          station: t.Any(),
          food: t.String(),
          totalPrice: t.Number(),
          status: t.Union([t.Literal("pending"), t.Literal("done"), t.Null()]),
          time: t.Any(),
        }),
      ),
    },
  )
  .post(
    "/api/register",
    async ({ body, set }) => {
      const { username, password } = body as any;
      if (!username || !password) {
        set.status = 400;
        return {
          success: false,
          message: "Username and pasword required",
        };
      }
      try {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .get();
        if (existingUser) {
          console.log(`Username already exist`);
          set.status = 401;
          return {
            success: false,
            message: "Username already exist",
          };
        }
        const hashPwd = await Bun.password.hash(password);
        await db.insert(users).values({
          username,
          password: hashPwd,
          role: "Customer",
          balance: 0,
        });
        console.log(`account with username ${username} has been created`);
        return {
          success: true,
          message: `account with username ${username} has been created`,
        };
      } catch (err) {
        console.log("internal server error");
        console.log(err);
        set.status = 500;
        return {
          success: false,
          message: "Failed creating user, internal server error",
        };
      }
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  )
  .post(
    "/api/login",
    async ({ body, set }) => {
      const { username, password, pcId } = body as any;

      if (!username || !password || !pcId) {
        set.status = 400;
        return {
          success: false,
          message: "Username, password, and pcId are required",
        };
      }

      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .get();
        if (!user || !(await Bun.password.verify(password, user.password))) {
          set.status = 401;
          return { success: false, message: "Invalid credentials" };
        }

        const targetPc = await db
          .select()
          .from(pcs)
          .where(eq(pcs.id, pcId))
          .get();

        if (!targetPc) {
          set.status = 404;
          return { success: false, message: "PC station not found" };
        }

        if (targetPc.status !== "vacant") {
          set.status = 400;
          return { success: false, message: "This PC is already occupied" };
        }
        await db
          .update(pcs)
          .set({
            status: "online",
            currentUserId: user.id,
            sessionStartTime: Date.now(),
          })
          .where(eq(pcs.id, pcId));

        return {
          success: true,
          message: `Welcome, ${username}! You are now logged into ${targetPc.pcNumber}`,
          user: { id: user.id, username: user.username, role: user.role },
        };
      } catch (error) {
        set.status = 500;
        return { success: false, message: `Backend error ${error}` };
      }
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        pcId: t.Number(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
        user: t.Optional(
          t.Object({
            id: t.Number(),
            username: t.String(),
            role: t.String(),
          }),
        ),
      }),
    },
  )
  .post(
    "/api/logout",
    async ({ body, set }) => {
      const { pcNumber } = body as any;
      if (!pcNumber) {
        set.status = 400;
        return {
          success: false,
          message: `Please provide a pc number`,
        };
      }
      try {
        await db
          .update(pcs)
          .set({
            status: "vacant",
            currentUserId: null,
            sessionStartTime: null,
            sessionEndTime: null,
          })
          .where(eq(pcs.pcNumber, pcNumber));
        console.log(`PC ${pcNumber} is now vacant again`);
        return {
          success: true,
          message: `Logout in ${pcNumber} successfull`,
        };
      } catch (error) {
        console.log(`logout error : ${error}`);
        set.status = 500;
        return {
          success: false,
          message: `Backend server error during logout ${error}`,
        };
      }
    },
    {
      body: t.Object({
        pcNumber: t.String(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  )
  .post(
    "/api/order",
    async ({ body, set }) => {
      const { userId, cart, pcId } = body as any;
      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .get();
        if (!user) {
          set.status = 404;
          return {
            success: false,
            message: `User is not found`,
          };
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
            items: JSON.stringify(cart), // Turn the cart array into a string for the DB!
            totalPrice: totalPrice, // Save the combined cost
            createdAt: Date.now(),
          });

          await tx
            .update(users)
            .set({ balance: user.balance - totalPrice })
            .where(eq(users.id, userId));
        });
        return {
          success: true,
          message: `Order has been placed`,
        };
      } catch (err) {
        console.log(err);
        set.status = 500;
        return {
          success: false,
          message: `Backend error  :  ${err}`,
        };
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        pcId: t.Number(),
        cart: t.Array(
          t.Object({
            foodId: t.Number(),
            qty: t.Number(),
          }),
        ),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/api/admin/orders/complete",
    async ({ body, set }) => {
      const { OrderID } = body as any;
      if (!OrderID) {
        set.status = 400;
        return {
          success: false,
          message: `OrderID not provided`,
        };
      }
      try {
        const targetOrder = await db
          .select()
          .from(orders)
          .where(eq(orders.id, OrderID))
          .get();
        if (!targetOrder) {
          set.status = 404;
          return {
            success: false,
            message: `Order not found`,
          };
        }
        await db
          .update(orders)
          .set({ status: "done" })
          .where(eq(orders.id, OrderID));
        return {
          success: true,
          messasge: `Orders ${OrderID} marked as done`,
        };
      } catch (err) {
        console.log(err);
        return {
          success: false,
          message: `Backend error ${err}`,
        };
      }
    },
    {
      body: t.Object({
        OrderID: t.Number(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        messasge: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/api/user/topup",
    async ({ body, set }) => {
      const { userId, amount } = body as any;

      if (!userId || !amount || amount <= 0) {
        set.status = 400;
        return { success: false, message: "Valid userId and amount required" };
      }

      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .get();

        if (!user) {
          set.status = 404;
          return { success: false, message: "User not found" };
        }

        await db
          .update(users)
          .set({ balance: user.balance + amount })
          .where(eq(users.id, userId));

        return {
          success: true,
          message: `Payment Confirmed! Added ${amount} to ${user.username}.`,
          newBalance: user.balance + amount,
        };
      } catch (err) {
        console.log("Top-up error:", err);
        set.status = 500;
        return { success: false, message: `Backend error during top-up` };
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        amount: t.Number(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
        newBalance: t.Optional(t.Number()),
      }),
    },
  )
  .post(
    "/api/session/buy",
    async ({ body, set }) => {
      const { userId, pcId, plans } = body;
      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .get();
        if (!user) {
          set.status = 404;
          return {
            success: false,
            message: `User ${userId} is not found`,
          };
        }
        let totalHours = 0;
        plans.forEach((p: any) => {
          if (p.planId === 1) totalHours += p.qty * 1;
          if (p.planId === 2) totalHours += p.qty * 5;
          if (p.planId === 3) totalHours += p.qty * 10;
        });
        let finalPrice = 0;
        let timeremaining = totalHours;
        const tens = Math.floor(timeremaining / 10);
        finalPrice += tens * 35;
        timeremaining %= 10;

        const fives = Math.floor(timeremaining / 5);
        finalPrice += fives * 18;
        timeremaining %= 5;

        const ones = timeremaining;
        finalPrice += ones * 4;

        if (user.balance < finalPrice) {
          set.status = 403;
          return {
            success: false,
            message: `User ${user.username} has insufficient balance`,
          };
        }
        const duration = totalHours * 60 * 60 * 1000; // in milliseconds
        await db.transaction(async (tx) => {
          const pc = await tx.select().from(pcs).where(eq(pcs.id, pcId)).get();
          const start =
            pc?.sessionEndTime && pc.sessionEndTime > Date.now()
              ? pc.sessionEndTime
              : Date.now();
          await tx
            .update(pcs)
            .set({
              status: "online",
              currentUserId : user.id,
              sessionStartTime : start,
              sessionEndTime : start + duration,
            })
            .where(eq(pcs.id, pcId));

          await tx
            .update(users)
            .set({
              balance: user.balance - finalPrice,
            })
            .where(eq(users.id, userId));
        });
        return {
          success: true,
          message: `Billing plans has been added for ${pcId}, by user ${user.username}`,
        };
      } catch (err) {
        set.status = 500;
        console.log(err);
        return {
          success: false,
          message: `Backend error ${err}`,
        };
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        pcId: t.Number(),
        plans: t.Array(t.Object({ planId: t.Number(), qty: t.Number() })),
      }),
    },
  )
  .delete(
    "/api/admin/orders/:id",
    async ({ params, set }) => {
      const { id } = params;
      try {
        const orderId = Number(id);
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
        return {
          success: true,
          message: `Order ${orderId} has been deleted`,
        };
      } catch (err) {
        set.status = 500;
        console.log(err);
        return {
          success: false,
          message: `Backend error ${err}`,
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  )
  .listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
