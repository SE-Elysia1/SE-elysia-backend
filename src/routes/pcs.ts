import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { pcs } from "../database/schema";
import { asc, eq } from "drizzle-orm";


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
)
.get('/pcs/:id/timer', async ({params, set})=>{
  const pc = await db.select().from(pcs).where(eq(pcs.id, Number(params.id))).get()
  if(!pc){
    set.status = 404
    return{
      success : false,
      message : `Pc ${params.id} doesn't exist`
    }
  }
  return {
    success :true,
    sessionEndTime : pc.sessionEndTime || 0,
    status : pc.status
  }
})