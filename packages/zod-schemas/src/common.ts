import { z } from "zod";
import { newId } from "@ecom/utils";

export const idSchema = z
  .string()
  .describe("Any non-empty string id — used for foreign key validation.");

export const emailSchema = z.string().trim().email().max(254).toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72)
  .regex(/[A-Za-z]/, "Password needs at least one letter")
  .regex(/\d/, "Password needs at least one digit");

export const phoneSchema = z
  .string()
  .regex(/^\+?\d{7,15}$/, "Invalid phone number format (E.164 or digits only)")
  .optional()
  .or(z.literal(""));

export const moneySchema = z.coerce
  .number()
  .gte(0, "Amount cannot be negative")
  .lte(1e9, "Amount too large")
  .step(0.01);

export const urlSlugSchema = z
  .string()
  .min(2)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Only lowercase letters, numbers, hyphens");

export const tempRefGenerator = (prefix = "ref"): string => newId(prefix);
