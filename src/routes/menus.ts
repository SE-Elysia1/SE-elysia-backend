import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { foodMenu } from "../database/schema";
import { asc } from "drizzle-orm";
import { PLANS } from "../constants";

export const menuRoutes = new Elysia({ prefix: "/api" })
  .get(
    "/menus",
    async ({ set }) => {
      try {
        const menus = await db.select().from(foodMenu).orderBy(asc(foodMenu.price));
        return { success: true, data: menus };
      } catch (error) {
        console.log("Failed to get menus");
        set.status = 500;
        return { success: false, message: "Failed to get Menu items" };
      }
    },
    {
      response: t.Object({
        success: t.Boolean(),
        data: t.Optional(t.Array(t.Any())),
        message: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/plans",
    () => ({ data: [... PLANS] }),
    {
      response: t.Object({
        data: t.Array(
          t.Object({
            id: t.Number(),
            hours: t.Number(),
            price: t.Number(),
            name: t.String(),
          }),
        ),
      }),
    },
  );