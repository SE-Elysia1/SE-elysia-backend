import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { pcs } from "../database/schema";
import { asc } from "drizzle-orm";

export const pcRoutes = new Elysia({ prefix: "/api" }).get(
  "/pcs",
  async ({ set }) => {
    try {
      const allPcs = await db.select().from(pcs).orderBy(asc(pcs.pcNumber));
      return { success: true, data: allPcs };
    } catch (error) {
      console.log("Failed to get PC status");
      set.status = 500;
      return { success: false, message: "Failed to get PC status" };
    }
  },
  {
    response: t.Object({
      success: t.Boolean(),
      data: t.Optional(t.Array(t.Any())),
      message: t.Optional(t.String()),
    }),
  },
);