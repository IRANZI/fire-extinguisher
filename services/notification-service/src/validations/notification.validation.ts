import { z } from "zod";

export const emailJobSchema = z.object({
  notificationId: z.string().uuid(),
  recipient: z.string().email(),
  subject: z.string().trim().min(1).max(220),
  message: z.string().trim().min(1),
});
