import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users, pcs, transactions } from "../database/schema";
import { eq } from "drizzle-orm";

export const sessionRoutes = new Elysia({ prefix: "/api" }).post(
  "/session/buy",
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
        return { success: false, message: `User not found` };
      }
      const pc = await db.select().from(pcs).where(eq(pcs.id, pcId)).get()
      if(!pc){
        set.status = 404
        return {
          success : false,
          message : `PC-${pcId} is not found`
        }
      }
      if(pc.currentUserId !== userId){
        set.status = 403
        return {
          success : false,
          message : `user ${user.username} isn't logged in at this PC`
        }
      }

      let totalHours = 0;
      plans.forEach((p) => {
        if (p.planId === 1) totalHours += p.qty * 1;
        if (p.planId === 2) totalHours += p.qty * 5;
        if (p.planId === 3) totalHours += p.qty * 10;
      });

      let finalPrice = 0;
      let remaining = totalHours;
      finalPrice += Math.floor(remaining / 10) * 35;
      remaining %= 10;
      finalPrice += Math.floor(remaining / 5) * 18;
      remaining %= 5;
      finalPrice += remaining * 4;

      if (user.balance < finalPrice) {
        set.status = 403;
        return {
          success: false,
          message: `Insufficient balance (Need ${finalPrice} Coins)`,
        };
      }

      const durationMs = totalHours * 60 * 60 * 1000;

      await db.transaction(async (tx) => {
       
        const currentEndTime = pc?.sessionEndTime ?? 0;
        const baseTime =
          currentEndTime > Date.now() ? currentEndTime : Date.now();
        const newEndTime = baseTime + durationMs;

        await tx
          .update(pcs)
          .set({
            status: "online",
            currentUserId: user.id,
            sessionEndTime: newEndTime,
          })
          .where(eq(pcs.id, pcId));

        await tx
          .update(users)
          .set({ balance: user.balance - finalPrice })
          .where(eq(users.id, userId));

        // Log Transaction
        await tx.insert(transactions).values({
          userId,
          type: "billing",
          coins: -finalPrice,
          description: `Billing: +${totalHours}h (PC ${pcId})`,
          pcId,
          createdAt: Date.now(),
        });
      });

      return {
        success: true,
        message: `Successfully added ${totalHours} hours to PC-${pcId}`,
        newEndTime: new Date(Date.now() + durationMs).toISOString(),
      };
    } catch (err) {
      set.status = 500;
      console.error("Session Buy Error:", err);
      return { success: false, message: `Internal server error` };
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
