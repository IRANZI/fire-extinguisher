import { z } from "zod";

export const uuidParam = z.object({ id: z.string().uuid() });

export const customerSchema = z.object({
  portalUserId: z.string().uuid().nullable().optional(),
  fullName: z.string().trim().min(2).max(140),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().min(4).max(500),
  nationalId: z.string().trim().max(80).optional().default(""),
  companyName: z.string().trim().max(140).optional().default(""),
});

export const customerUpdateSchema = customerSchema.omit({ portalUserId: true }).partial();
