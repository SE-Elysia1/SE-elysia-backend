import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users, pcs } from "../database/schema";
import { eq } from "drizzle-orm";

export const authRoutes = new Elysia({ prefix: "/api" })
  .post(
    "/register",
    async ({ body, set }) => {
      const { username, password } = body;
      try {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .get();

        if (existingUser) {
          set.status = 401;
          return { success: false, message: "Username already exist" };
        }

        const hashPwd = await Bun.password.hash(password, {
          algorithm: "argon2id", // 🛡️ Explicitly tell Bun to use Argon2id
          memoryCost: 65536, // Uses 64MB of RAM to make GPU cracking expensive
          timeCost: 3, // Number of passes the algorithm makes
        });
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
        console.log("internal server error", err);
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
    "/login",
    async ({ body, set }) => {
      const { username, password, pcId } = body;
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
    "/logout",
    async ({ body, set }) => {
      const { pcId } = body;
      try {
        await db
          .update(pcs)
          .set({
            status: "vacant",
            currentUserId: null,
            sessionEndTime: null,
          })
          .where(eq(pcs.id, pcId));

        console.log(`PC ID ${pcId} is now vacant again`);
        return {
          success: true,
          message: `Logout for PC ID ${pcId} successful`,
        };
      } catch (error) {
        console.log(`Logout error: ${error}`);
        set.status = 500;
        return {
          success: false,
          message: `Backend server error during logout: ${error}`,
        };
      }
    },
    {
      body: t.Object({ pcId: t.Number() }),
      response: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  );
