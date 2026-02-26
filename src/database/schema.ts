import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: integer("id").primaryKey(),
    username: text("username").unique().notNull(),
    password: text("password").notNull(),
    balance: integer("balance").default(0).notNull(),
    role: text("role").notNull()
});

export const pcs = sqliteTable("pcs", {
    id: integer("id").primaryKey(),
    pcNumber: text("pc_number").unique().notNull(),
    status: text("status").$type<"online" | "offline" | "vacant">().default("vacant").notNull(),
    currentUserId: integer("currentUserId").references(() => users.id), //foreign key
    sessionStartTime: integer("sessionStartTime"), 
    sessionEndTime: integer("sessionEndTime")
});

export const foodMenu = sqliteTable("food_menu", {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
});

export const orders = sqliteTable("orders", {
    id: integer("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(), //foreign key
    items : text("items").notNull(), //store order in JSOn like structure to handle multiple menu in 1 orders
    totalPrice : integer("total_price").notNull(),
    pcId :  integer("pcId").references(()=>pcs.id).notNull(), //foreign key
    status: text("status").$type<"pending" | "done">().default("pending"),
    createdAt: integer("created_at").notNull(),
});