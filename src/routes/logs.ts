import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users, transactions } from "../database/schema";
import { eq, and, asc } from "drizzle-orm";

export const logRoutes = new Elysia({ prefix: "/api" }).get(
  "/logs",
  async ({ query, set }) => {
    const { requestingUserId, targetUserId, type } = query;

    const requester = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(requestingUserId)))
      .get();

    if (!requester) {
      set.status = 401;
      return { success: false, message: "Unauthorized: User not found" };
    }

    const filters = [];

    if (requester.role === "admin") {
      if (targetUserId) {
        filters.push(eq(transactions.userId, Number(targetUserId)));
      }
    } else {
      filters.push(eq(transactions.userId, requester.id));
    }

    if (type) {
      filters.push(eq(transactions.type, type as any));
    }

    const rawLogs = await db
      .select()
      .from(transactions)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(transactions.createdAt))
      .all();

    return rawLogs.map((log) => ({
      ...log,
      displayDate: new Date(log.createdAt).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    }));
  },
  {
    query: t.Object({
      requestingUserId: t.String(),
      targetUserId: t.Optional(t.String()),
      type: t.Optional(t.String()),
    }),
  },
);