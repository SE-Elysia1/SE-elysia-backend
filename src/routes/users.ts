import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users } from "../database/schema";
import { eq } from "drizzle-orm";

export const userRoutes = new Elysia({ prefix: "/api" }).get(
  "/user/:userId",
  async ({ params, set }) => {
    const userId = Number(params.userId)
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!user) {
      set.status = 404;
      return {
        success: false,
        message: `user with userId ${userId}is not found`,
      };
    }
    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        coin: user.balance,
      },
    };
  },
  {
    params: t.Object({ userId: t.String() }),
    response: t.Object({
      success: t.Boolean(),
      message: t.Optional(t.String()),
      data: t.Optional(
        t.Object({
          id: t.Number(),
          username: t.String(),
          coin: t.Number(),
        }),
      ),
    }),
  },
);
