import { z } from "zod";
export const leadContactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  whatsapp: z
    .string()
    .trim()
    .max(40)
    .refine(
      (value) =>
        /^\+[\d\s()-]+$/.test(value) &&
        /^\d{8,15}$/.test(value.replace(/\D/g, "")),
    )
    .transform((value) => "+" + value.replace(/\D/g, "")),
  email: z.string().trim().max(254).pipe(z.email()),
  consent: z.literal(true),
});
