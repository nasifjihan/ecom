import { z } from "zod";

export const SuperLoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const AdminLoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const CustomerLoginDto = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export const CustomerRegisterDto = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "uppercase")
    .regex(/[0-9]/, "digit"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  acceptMarketing: z.boolean().default(false),
});

export const AdminOwnerRegisterFirstDto = z.object({
  storeId: z.coerce.bigint(),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string(),
  lastName: z.string(),
  roleId: z.coerce.bigint().optional(),
});

export const RefreshTokenDto = z.object({
  refreshToken: z.string().optional(),
});

export const ForgotPasswordDto = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const CustomerResetPasswordDto = z.object({
  token: z.string().min(10).max(2000),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

export const AdminResetPasswordDto = z.object({
  token: z.string().min(10).max(2000),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export type SuperLoginDto = z.infer<typeof SuperLoginDto>;
export type AdminLoginDto = z.infer<typeof AdminLoginDto>;
export type CustomerLoginDto = z.infer<typeof CustomerLoginDto>;
export type CustomerRegisterDto = z.infer<typeof CustomerRegisterDto>;
export type AdminOwnerRegisterFirstDto = z.infer<typeof AdminOwnerRegisterFirstDto>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>;
export type CustomerResetPasswordDto = z.infer<typeof CustomerResetPasswordDto>;
export type AdminResetPasswordDto = z.infer<typeof AdminResetPasswordDto>;
