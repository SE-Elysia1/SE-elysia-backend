import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../database/db";
import { users, transactions } from "../database/schema";
import { eq } from "drizzle-orm";

export const topupRoutes = new Elysia({ prefix: "/api" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET!,
    }),
  )
  .post(
    "/user/topup",
    async ({ body, headers, jwt, set }) => {
      const token = headers.authorization?.replace("Bearer ", "");
      if (!token) {
        set.status = 401;
        return { success: false, message: "Unauthorized: No token provided" };
      }

      const payload = await jwt.verify(token);
      if (!payload) {
        set.status = 401;
        return {
          success: false,
          message: "Unauthorized: Invalid or expired token",
        };
      }

      if (String(payload.userId) !== String(body.userId)) {
        set.status = 403;
        return {
          success: false,
          message: "Forbidden: userId does not match token",
        };
      }

      const { userId, amount } = body;

      if (amount <= 0) {
        set.status = 400;
        return { success: false, message: "Amount must be greater than 0" };
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
            description: `Top-up: +${amount} Coins`,
            createdAt: Date.now(),
          });
        });

        return {
          success: true,
          message: `Payment Confirmed! Added ${amount} to ${user.username}.`,
          newBalance: user.balance + amount,
        };
      } catch (err) {
        console.log("Top-up error:", err);
        set.status = 500;
        return { success: false, message: "Backend error during top-up" };
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
        idr: t.Optional(t.Number()),
      }),
    },
  );
