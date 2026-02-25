import cors from "@elysiajs/cors";
import { Elysia, t } from "elysia";
// import { seed } from "./database/seed"; //uncomment this to seed admin account and pc database
import { pcs } from "./database/schema";
import { db } from "./database/db";
import { asc } from "drizzle-orm";
import { users } from "./database/schema";
import { eq } from "drizzle-orm";
import { foodMenu } from "./database/schema";
import os from "os"
// seed() //uncomment this to seed database


if(os.platform() === "win32"){
  console.log("Here's a nickel, Get yourself a real OS and stop using windows")
  
}



const app = new Elysia()
  .get("/", () => "Hello Elysia")
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
    const { username, password, pcNumber } = body as any;
    if (!username || !password) {
      set.status = 400;
      return {
        success: false,
        message: `Username and password is required`,
      };
    }
    try {
      const cust = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();
      if (!cust) {
        console.log(`Username ${username} doesn't exist`);
        set.status = 404;
        return {
          success: false,
          message: `username ${username} is not found`,
        };
      }
      const isMatch = await Bun.password.verify(password, cust.password);
      if (!isMatch) {
        console.log(`Password do not match`);
        set.status = 403;
        return {
          success: false,
          message: `Password do not match`,
        };
      }
      if (cust.role.toLowerCase() === "admin") {
        console.log("Admin detected");
        return {
          success: true,
          message: `admin ${username} has logged in`,
          data: {
            id: cust.id,
            username: cust.username,
            role: cust.role,
            balance: cust.balance,
          },
        };
      }
      if (!pcNumber) {
        set.status = 400;
        return {
          success: false,
          message: `Customer must pass a valid PC number`,
        };
      }
      const targetPc = await db
        .select()
        .from(pcs)
        .where(eq(pcs.pcNumber, pcNumber))
        .get();
      if (!targetPc) {
        set.status = 404;
        return {
          success: false,
          message: `Pc not found, ensure the PC number is a valid number`,
        };
      }
      if (targetPc.status.toLowerCase() !== "vacant") {
        set.status = 409;
        return {
          success: false,
          message: `This pc is occupied`,
        };
      }
      await db
        .update(pcs)
        .set({ status: "online", currentUserId: cust.id })
        .where(eq(pcs.pcNumber, pcNumber));
      console.log(`Customer ${cust.username} has logged in to pc ${pcNumber}`);
      return {
        success: true,
        message: `Customer ${cust.username} has logged in to pc ${pcNumber}`,
        data: {
          id: cust.id,
          username: cust.username,
          role: cust.role,
          balance: cust.balance,
        },
      };
    } catch (error) {
      console.log(error);
      set.status = 500;
      return {
        success: false,
        message: `Backend error ${error}`,
      };
    }
  })
  .post('/api/logout', async({body, set})=>{
    const{pcNumber} = body as any
    if(!pcNumber){
      set.status = 400
      return{
        success : false,
        message : `Please provide a pc number`
      }
    }
    try{
      await db.update(pcs).set({
        status : "vacant",
        currentUserId : null,
        sessionStartTime : null,
        sessionEndTime : null,
      }).where(eq(pcs.pcNumber, pcNumber))
      console.log(`PC ${pcNumber} is now vacant again`)
      return{
        success :true,
        message : `Logout in ${pcNumber} successfull`
      }
    }
    catch(error){
      console.log(`logout error : ${error}`)
      set.status = 500
      return{
        success : false,
        message : `Backend server error during logout`
      }
    }
    
  })
  .listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
