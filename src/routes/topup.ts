import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users, transactions } from "../database/schema";
import { eq } from "drizzle-orm";

export const topupRoutes = new Elysia({ prefix: "/api" }).post(
  "/user/topup",
  async ({ body, set }) => {
    const { userId, amount } = body;

    if (amount <= 0) {
      set.status = 400;
      return { success: false, message: "Amount must be greater than 0" };
    }

    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).get();

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