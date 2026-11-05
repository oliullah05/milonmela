import { z } from "zod";
export const mobile = z
  .string()
  .transform((v) =>
    v
      .replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d))
      .replace(/[\s-]/g, "")
      .replace(/^\+?88/, ""),
  )
  .pipe(z.string().regex(/^01[3-9]\d{8}$/, "সঠিক বাংলাদেশি মোবাইল নম্বর দিন"));
const optional = z.string().trim().max(300).optional().default("");
export const payment = z.object({
  method: z.enum(["nagad", "rocket"]),
  transactionId: z
    .string()
    .trim()
    .min(4)
    .max(60)
    .regex(/^[a-zA-Z0-9-]+$/).transform(v=>v.toUpperCase()),
  senderMobileNumber: z
    .union([z.literal(""), mobile])
    .optional()
    .default(""),
});
export const registration = payment.extend({
  name: z.string().trim().min(2).max(100),
  mobile,
  batchYear: z.coerce
    .number()
    .int()
    .min(1970)
    .max(new Date().getFullYear() + 1),
  bloodGroup: z
    .enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "জানি না"])
    .optional()
    .default(""),
  address: optional,
  email: z
    .union([z.literal(""), z.email()])
    .optional()
    .default(""),
  photoUrl: z.string().max(500).optional().default(""),
});

