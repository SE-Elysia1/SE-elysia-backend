import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users, pcs, transactions } from "../database/schema";
import { eq } from "drizzle-orm";

export const sessionRoutes = new Elysia({ prefix: "/api" }).post(
  "/session/buy",
  async ({ body, set }) => {
    const { userId, pcId, plans } = body;
    try {
      const user = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) {
        set.status = 404;
        return { success: false, message: `User ${userId} is not found` };
      }

      let totalHours = 0;
      plans.forEach((p) => {
        if (p.planId === 1) totalHours += p.qty * 1;
        if (p.planId === 2) totalHours += p.qty * 5;
        if (p.planId === 3) totalHours += p.qty * 10;
      });

      // Calculate price using the best plan combination
      let finalPrice = 0;
      let remaining = totalHours;
      finalPrice += Math.floor(remaining / 10) * 35;
      remaining %= 10;
      finalPrice += Math.floor(remaining / 5) * 18;
      remaining %= 5;
      finalPrice += remaining * 4;

      if (user.balance < finalPrice) {
        set.status = 403;
        return { success: false, message: `User ${user.username} has insufficient balance` };
      }

      const duration = totalHours * 60 * 60 * 1000;

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
            currentUserId: user.id,
            sessionStartTime: start,
            sessionEndTime: start + duration,
          })
          .where(eq(pcs.id, pcId));

        await tx
          .update(users)
          .set({ balance: user.balance - finalPrice })
          .where(eq(users.id, userId));

        await tx.insert(transactions).values({
          userId,
          type: "billing",
          coins: -finalPrice,
          description: `Billing Packet: ${totalHours} Hours (PC-${pcId})`,
          pcId,
          createdAt: Date.now(),
        });
      });

      return {
        success: true,
        message: `Billing plans added for PC-${pcId}, user ${user.username}, ${totalHours}h total`,
      };
    } catch (err) {
      set.status = 500;
      console.log(err);
      return { success: false, message: `Backend error ${err}` };
    }
  },
  {
    body: t.Object({
      userId: t.Number(),
      pcId: t.Number(),
      plans: t.Array(t.Object({ planId: t.Number(), qty: t.Number() })),
    }),
  },
);