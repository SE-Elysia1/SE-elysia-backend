import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
//uncomment this to seed admin account and pc database
import { orders, pcs } from "./database/schema";
import { db } from "./database/db";
import { asc } from "drizzle-orm";
import { users } from "./database/schema";
import { eq } from "drizzle-orm";
import { foodMenu } from "./database/schema";
import { openapi, fromTypes } from "@elysiajs/openapi";
import os from "os";
//uncomment this to seed database
// import { seed } from "./database/seed";
// seed()

if (os.platform() === "win32") {
  console.log("Here's a nickel, Get yourself a real OS and stop using windows");
}

const app = new Elysia()
  .get("/", () => "Elysia is replying from the Elysian Realm") //test
  .use(
    openapi({
      references: fromTypes(),
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
  .get("/api/pcs", async ({ set }) => {
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
  })
  .get("/api/menus", async ({ set }) => {
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
  })
  .get("/api/plans", async ({ set }) => {
    return {
      data: [
        { id: 1, hours: 1, price: 4, name: "1 Hour Quick Play" },
        { id: 2, hours: 5, price: 18, name: "5 Hour Marathon" },
        { id: 3, hours: 10, price: 35, name: "10 Hour All-Nighter" },
      ],
    };
  })
  .get("/api/admin/orders", async ({}) => {
    return await db
      .select({
        id: orders.id,
        customer: users.username,
        food: foodMenu.name,
        station: pcs.pcNumber,
        status: orders.status,
        time: orders.createdAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .innerJoin(foodMenu, eq(orders.foodId, foodMenu.id))
      .innerJoin(pcs, eq(orders.pcId, pcs.id))
      .where(eq(orders.status, "pending"))
      .all();
  })
  .post("/api/register", async ({ body, set }) => {
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
  })
  .post("/api/login", async ({ body, set }) => {
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
  })
  .post("/api/logout", async ({ body, set }) => {
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
  })
  .post("/api/order", async ({ body, set }) => {
    const { userId, foodId, pcId } = body as any;
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();
      const food = await db
        .select()
        .from(foodMenu)
        .where(eq(foodMenu.id, foodId))
        .get();
      if (!user || !food) {
        set.status = 404;
        return {
          success: false,
          message: `User or Food items is not found`,
        };
      }
      if (user.balance < food.price) {
        set.status = 400;
        return {
          success: false,
          message: `User ${user.username} has insufficient balance`,
        };
      }
      await db.transaction(async (tx) => {
        await tx.insert(orders).values({
          userId,
          foodId,
          pcId,
          createdAt: Date.now(),
        });

        await tx
          .update(users)
          .set({ balance: user.balance - food.price })
          .where(eq(users.id, userId));
      });

      return { success: true, message: `Order for ${food.name} placed!` };
    } catch (err) {
      console.log(err);
      set.status = 500;
      return {
        success: false,
        message: `Backend error ${err}`,
      };
    }
  })
  .post("/api/admin/orders/complete", async ({ body, set }) => {
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
  })
  .delete('/api/admin/orders/:id', async({params, set})=>{
    const{id}= params
    try{
      const orderId = Number(id)
      const targetOrder = await db.select().from(orders).where(eq(orders.id, orderId)).get()
      if(!targetOrder){
        set.status = 404
        return{
          success : false,
          message : `Order ${orderId} cannot be found`
        }
      }
      await db.delete(orders).where(eq(orders.id, orderId))
      return{
        success : true,
        message : `Order ${orderId} has been deleted`
      }
    }
    catch(err){
      set.status = 500
      console.log(err)
      return{
        success : false,
        message : `Backend error ${err}`
      }
    }
  })
  .listen(4000);
  
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
