import { z } from "zod";

export const extinguisherIdParam = z.object({ id: z.string().uuid() });

export const extinguisherSchema = z
  .object({
    customerId: z.string().uuid(),
    serialNumber: z.string().trim().min(2).max(100),
    extinguisherType: z.string().trim().min(2).max(80),
    capacityKg: z.coerce.number().positive().max(1000),
    manufacturer: z.string().trim().max(120).optional().default(""),
    purchaseDate: z.coerce.date(),
    expiryDate: z.coerce.date(),
    notes: z.string().trim().max(1000).optional().default(""),
  })
  .refine((data) => data.expiryDate >= data.purchaseDate, {
    message: "Expiry date must be on or after purchase date",
    path: ["expiryDate"],
  });
