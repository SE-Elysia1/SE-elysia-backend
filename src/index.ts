import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import cors from "@elysiajs/cors";
import { openapi, fromTypes } from "@elysiajs/openapi";
import os from "os";
import { rateLimitMiddleware } from "./middleware/ratelimit";
import { authRoutes } from "./routes/auth";
import { pcRoutes } from "./routes/pcs";
import { menuRoutes } from "./routes/menus";
import { orderRoutes } from "./routes/orders";
import { sessionRoutes } from "./routes/sessions";
import { logRoutes } from "./routes/logs";
import { topupRoutes } from "./routes/topup";

// Uncomment to seed admin account and pc database
// import { seed } from "./database/seed";
// seed();

if (os.platform() === "win32") {
  console.log("Here's a nickel, Get yourself a real OS and stop using windows");
}

const app = new Elysia()
  .use(rateLimitMiddleware)
  .use(openapi({ references: fromTypes() }))
  .use(
    swagger({
      documentation: {
        info: { title: "SE-Elysia API DOCS", version: "2.0.0" },
      },
    }),
  )
  .use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:8080",
      ],
    }),
  )
  .get("/", () => "Elysia is replying from the Elysian Realm")
  .use(authRoutes)
  .use(pcRoutes)
  .use(menuRoutes)
  .use(orderRoutes)
  .use(sessionRoutes)
  .use(logRoutes)
  .use(topupRoutes)
  .listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);