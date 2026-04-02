import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../database/db";
import { users, transactions } from "../database/schema";
import { eq } from "drizzle-orm";

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET! }))
  .derive(async ({ headers, jwt, set }) => {
    const token = headers.authorization?.replace("Bearer ", "");
    if (!token) {
      set.status = 401;
      throw new Error("Unauthorized: No token provided");
    }

    const payload = await jwt.verify(token);
    if (!payload) {
      set.status = 401;
      throw new Error("Unauthorized: Invalid or expired token");
    }

    if (payload.role !== "admin") {
      set.status = 403;
      throw new Error("Forbidden: Admin access only");
    }

    return { adminPayload: payload };
  })

  .put(
    "/user/:userId/override",
    async ({ params, body, adminPayload, set }) => {
      const { newUsername, newPassword } = body as any;
      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(adminPayload.userId)))
          .get();

        if (!admin) {
          set.status = 404;
          return { success: false, message: "Admin user not found" };
        }

        const targetId = Number(params.userId);
        const targetUser = await db
          .select()
          .from(users)
          .where(eq(users.id, targetId))
          .get();

        if (!targetUser) {
          set.status = 404;
          return { success: false, message: "Customer not found" };
        }

        const updateData: any = {};
        if (newUsername) updateData.username = newUsername;
        if (newPassword) {
          updateData.password = await Bun.password.hash(newPassword, {
            algorithm: "argon2id",
            memoryCost: 65536,
            timeCost: 3,
          });
        }

        await db.update(users).set(updateData).where(eq(users.id, targetId));

        return {
          success: true,
          message: `Admin ${admin.username} successfully updated profile for ${targetUser.username}`,
        };
      } catch (err) {
        set.status = 500;
        return { success: false, message: `Server error: ${err}` };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        newUsername: t.Optional(t.String()),
        newPassword: t.Optional(t.String()),
      }),
    },
  )

  .delete(
    "/user/:userId",
    async ({ params, adminPayload, set }) => {
      try {
        const targetId = Number(params.userId);

        if (targetId === Number(adminPayload.userId)) {
          set.status = 400;
          return {
            success: false,
            message: "Admin account deletion is attempted!!",
          };
        }

        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, targetId))
          .get();
        if (!user) {
          set.status = 404;
          return {
            success: false,
            message: `User with id ${targetId} is not found`,
          };
        }

        await db.delete(users).where(eq(users.id, targetId));
        return {
          success: true,
          message: `User ${user.username} has been deleted`,
        };
      } catch (err) {
        set.status = 500;
        return { success: false, message: `Backend Server Error ${err}` };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
    },
  )

  .get(
    "/user/:userId",
    async ({ params, set }) => {
      const userId = Number(params.userId);
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();

      if (!user) {
        set.status = 404;
        return {
          success: false,
          message: `User with userId ${userId} is not found`,
        };
      }

      return {
        success: true,
        data: { id: user.id, username: user.username, coin: user.balance },
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        data: t.Optional(
          t.Object({ id: t.Number(), username: t.String(), coin: t.Number() }),
        ),
      }),
    },
  )

  .get("/users", async ({ set }) => {
    try {
      const customers = await db
        .select({
          id: users.id,
          username: users.username,
          balance: users.balance,
          role: users.role,
        })
        .from(users)
        .where(eq(users.role, "Customer"))
        .all();

      return { success: true, data: customers };
    } catch (err) {
      set.status = 500;
      return { success: false, message: `Server error ${err}` };
    }
  })

  .post(
    "/user/topup",
    async ({ body, adminPayload, set }) => {
      const { userId, amount } = body;

      if (amount <= 0) {
        set.status = 400;
        return { success: false, message: "Amount must be greater than 0" };
      }

      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(adminPayload.userId)))
          .get();

        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .get();
        if (!user) {
          set.status = 404;
          return { success: false, message: "User not found" };
        }

        const idr = amount * 2000;

        await db.transaction(async (tx) => {
          await tx
            .update(users)
            .set({ balance: user.balance + amount })
            .where(eq(users.id, userId));

          await tx.insert(transactions).values({
            userId,
            type: "topup",
            coins: amount,
            incomeIdr: idr,
            description: `Cash Top-up by Admin ${admin?.username}: +${amount} Coins`,
            createdAt: Date.now(),
          });
        });

        return {
          success: true,
          message: `Added ${amount} coins to ${user.username}`,
          newBalance: user.balance + amount,
        };
      } catch (err) {
        set.status = 500;
        return { success: false, message: `Backend error: ${err}` };
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
  );
