import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../database/db";
import { users, transactions } from "../database/schema";
import { eq, and, asc } from "drizzle-orm";

export const logRoutes = new Elysia({ prefix: "/api" })
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET! }))
  .get(
    "/logs",
    async ({ query, headers, jwt, set }) => {
      const token = headers.authorization?.replace("Bearer ", "");
      if (!token) {
        set.status = 401;
        return { success: false, message: "Unauthorized: No token provided" };
      }

      const payload = await jwt.verify(token);
      if (!payload) {
        set.status = 401;
        return { success: false, message: "Unauthorized: Invalid or expired token" };
      }

      const { targetUserId, type } = query;
      const filters = [];

      if (payload.role === "admin") {
        if (targetUserId) {
          filters.push(eq(transactions.userId, Number(targetUserId)));
        }
      } else {
        filters.push(eq(transactions.userId, Number(payload.userId)));
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
        targetUserId: t.Optional(t.String()),
        type: t.Optional(t.String()),
      }),
    },
  );