import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { users } from "../database/schema";
import { eq } from "drizzle-orm";

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .put(
    "/user/:userId/override",
    async ({ params, body, query, set }) => {
      const { userId } = params;
      const { requesterId } = query;
      const { newUsername, newPassword } = body as any;
      if(!requesterId){
        set.status = 401
        return{
            success :false,
            message : `Requesterid is needed to perform this action`
        }
      }
      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(requesterId)))
          .get();

        if (!admin || admin.role.toLowerCase() !== "admin") {
          set.status = 403;
          return {
            success: false,
            message: "Forbidden! Only Admins can override profiles!",
          };
        }

        const targetId = Number(userId);
        const targetUser = await db
          .select()
          .from(users)
          .where(eq(users.id, targetId))
          .get();

        if (!targetUser) {
          set.status = 404;
          return { success: false, message: "Customer not found" };
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
          message: `Admin ${admin.username} successfully updated profile for ${targetUser.username}`,
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
      query: t.Object({
        requesterId: t.String(),
      }),
      body: t.Object({
        newUsername: t.Optional(t.String()),
        newPassword: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/user/:userId",
    async ({ params, query, set }) => {
      const { userId } = params;
      const { requesterId } = query;
      if (!requesterId) {
        set.status = 401;
        return {
          success: false,
          message: `Unauthorized, requesterId is required`,
        };
      }
      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(requesterId)))
          .get();
        if (!admin || admin.role.toLowerCase() !== "admin") {
          set.status = 403;
          return {
            success: false,
            message: `Forbidden!! An admin is required to perform this operation!`,
          };
        }
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(userId)))
          .get();
        if (!user) {
          set.status = 404;
          return {
            success: false,
            message: `User with id ${userId} is not found`,
          };
        }
        if (Number(userId) === admin.id) {
          set.status = 400;
          return {
            success: false,
            message: `Admin account deletion is attempted!!`,
          };
        }
        await db.delete(users).where(eq(users.id, Number(userId)));

        return {
          success: true,
          message: `User ${user.username} has been deleted`,
        };
      } catch (err) {
        set.status = 500;
        return {
          success: false,
          message: `Backend Server Error ${err}`,
        };
      }
    },
    {
      params: t.Object({
        userId: t.String(),
      }),
      query: t.Object({
        requesterId: t.String(),
      }),
    },
  )
  .get(
    "/user/:userId",
    async ({ query, params, set }) => {
      const {requesterId} = query
      if(!requesterId){
        set.status = 401
        return{
            success : false,
            message : `Requesterid is needed to perform this action`
        }
      }
      const admin = await db.select().from(users).where(eq(users.id, Number(requesterId))).get()
      if(!admin || admin.role.toLowerCase()!== 'admin'){
        set.status = 403
        return{
            success : false,
            message : `Forbidden! an admin only operation`
        }
      }
      const userId = Number(params.userId);
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
      query :  t.Object({requesterId : t.String()}),
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
  )

  .get(
    "/users",
    async ({ query, set }) => {
      const { requesterId } = query;
      if (!requesterId) {
        set.status = 401;
        return {
          success: false,
          message: `Unauthorized! requesterId is required to access this value`,
        };
      }
      try {
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(requesterId)))
          .get();
        if (!admin || admin.role.toLowerCase() !== "admin") {
          set.status = 403;
          return { success: false, message: "Forbidden: Admin access only" };
        }
        const customers = await db
          .select({
            id: users.id,
            username: users.username,
            balance: users.balance,
            role: users.role,
          })
          .from(users)
          .where(eq(users.role, "Customer"))
          .all();

        return {
          success: true,
          data: customers,
        };
      } catch (err) {
        set.status = 500;
        return {
          success: false,
          message: `Server error ${err}`,
        };
      }
    },
    {
      query: t.Object({
        requesterId: t.String(),
      }),
    },
  );
