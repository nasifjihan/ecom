/**
 * SHARED ZOD VALIDATION SCHEMAS
 * Import these in:
 *   - API route DTOs (zod validate middleware)
 *   - Frontend react-hook-form + zodResolver
 * This ensures DTOs CANNOT be inconsistent between frontend & backend validation.
 *
 * Schemas are organised by module inside `./src/modules/` once we add them.
 */
import { z } from "zod";
import {
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  CustomerStatus,
  ExportFormat,
} from "@ecom/shared-types";

/**
 * Pagination params — EVERY list endpoint uses these.
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().min(1).default(1),
  perPage: z.coerce.number().int().positive().min(1).max(100).default(20),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  search: z.string().max(100).optional(),
});
export type PaginationDto = z.infer<typeof PaginationSchema>;

export const IdParamSchema = z.object({
  id: z.coerce.bigint().positive(),
});

export const SlugParamSchema = z.object({
  slug: z.string().min(2).max(200),
});

export const ExportQuerySchema = PaginationSchema.extend({
  format: z.nativeEnum(ExportFormat).default(ExportFormat.CSV),
  sendEmail: z.coerce.boolean().default(false),
});

export const CommonStatuses = {
  ProductStatus,
  OrderStatus,
  PaymentStatus,
  CustomerStatus,
};

export * as Common from "./common";
