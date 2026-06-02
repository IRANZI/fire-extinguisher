import { z } from "zod";

export const uuidParam = z.object({ id: z.string().uuid() });
export const reportStatusSchema = z.object({
  status: z.enum(["OPEN", "REVIEWING", "CLOSED"]),
});
