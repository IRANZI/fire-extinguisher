import rateLimit from "express-rate-limit";

export const gatewayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 800,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
