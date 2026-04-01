import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users } from "../database/schema";
import { eq } from "drizzle-orm";

export const userRoutes = new Elysia({ prefix: "/api/user" }).put(
  "/manage/:userId",
  async ({ params, body, set }) => {
    const { userId } = params;
    const { currentPassword, newUsername, newPassword } = body as any;

    try {
      const targetId = Number(userId);
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, targetId))
        .get();

      if (!user) {
        set.status = 404;
        return { success: false, message: "User not found" };
      }

      const isPasswordCorrect = await Bun.password.verify(
        currentPassword,
        user.password,
      );
      if (!isPasswordCorrect) {
        set.status = 401;
        return {
          success: false,
          message: "Incorrect current password! Update denied.",
        };
      }

      const updateData: any = {};

      if (newUsername) {
        updateData.username = newUsername;
      }

      if (newPassword) {
        updateData.password = await Bun.password.hash(newPassword, {
          algorithm: "argon2id",
          memoryCost: 65536,
          timeCost: 3,
        });
      }

      await db.update(users).set(updateData).where(eq(users.id, targetId));

      return {
        success: true,
        message: "Profile updated successfully!",
      };
    } catch (err) {
      set.status = 500;
      return { success: false, message: `Server error: ${err}` };
    }
  },
  {
    params: t.Object({
      userId: t.String(),
    }),
    body: t.Object({
      currentPassword: t.String(),
      newUsername: t.Optional(t.String()),
      newPassword: t.Optional(t.String()),
    }),
  },
)
.get("/:userId", async ({params, set})=>{
  try{
    const targetId = Number(params.userId)
    const user = await db.select({username : users.username, balance : users.balance}).from(users).where(eq(users.id, targetId)).get()
    if(!user){
      set.status = 404
      return{
        success :false,
        message : `User not found`
      }
    }
    return {
      success : true,
      data: user,
    }

  }catch(err){
    set.status =500
    return{
      success : false,
      message : `Server error ${err}`
    }
  }
},{
  params : t.Object({
    userId : t.String()
  })
})
