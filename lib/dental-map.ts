import { z } from "zod";

export const toothNumbers = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46,
  45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
] as const;
export const dentalMapSchema = z
  .object({
    skipped: z.boolean(),
    teeth: z
      .array(
        z.object({
          number: z
            .number()
            .int()
            .refine((n) => (toothNumbers as readonly number[]).includes(n)),
          status: z.enum(["missing", "concern"]),
        }),
      )
      .max(32),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.teeth.map((t) => t.number)).size !== value.teeth.length ||
      (value.skipped && value.teeth.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Revisa las piezas seleccionadas.",
      });
  });
export type DentalMapValue = z.infer<typeof dentalMapSchema>;
export function dentalMapSummary(value: DentalMapValue) {
  if (value.skipped)
    return "La persona prefirió describir su situación durante la conversación.";
  if (!value.teeth.length)
    return "La persona no señaló piezas ausentes ni con molestias en el mapa.";
  return [
    ["missing", "Piezas que indica como ausentes"],
    ["concern", "Piezas en las que indica molestias o preocupación"],
  ]
    .flatMap(([status, label]) => {
      const teeth = value.teeth
        .filter((t) => t.status === status)
        .map((t) => t.number);
      return teeth.length
        ? [`${label} (numeración FDI): ${teeth.join(", ")}.`]
        : [];
    })
    .join(" ");
}
