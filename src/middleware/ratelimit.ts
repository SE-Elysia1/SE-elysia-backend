import { rateLimit } from "elysia-rate-limit";

export const rateLimitMiddleware = rateLimit({
  duration: 60000,
  max: 7,
  errorResponse: `Too many request`,
  scoping: `global`,
  generator: (request) => {
    return (
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown"
    );
  },
});