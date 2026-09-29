import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";
import { ExportFormat, CustomerStatus } from "@ecom/shared-types";

const XSS_RE = /<script|<iframe|onerror=|onload=|onclick=|onmouseover=/i;
const noXss = (v: string | null | undefined): boolean => {
  if (v === null || v === undefined || v.length === 0) return true;
  XSS_RE.lastIndex = 0;
  return !XSS_RE.test(v);
};

const noXssMessage = "No JavaScript injection allowed";

const BD_PHONE_RE = /^(\+?8801|01)[3-9]\d{8}$/;

export const CustomerIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type CustomerIdParamDto = z.infer<typeof CustomerIdParamDto>;
export const AddressIdParamDto = z.object({ addressId: z.coerce.bigint().positive() });
export type AddressIdParamDto = z.infer<typeof AddressIdParamDto>;

const BaseCustomerAddressDto = z.object({
  type: z.enum(["billing", "shipping"]),
  label: z.string().max(100).optional().nullable(),
  firstName: z.string().min(1).max(100).refine(noXss, noXssMessage),
  lastName: z.string().min(1).max(100).refine(noXss, noXssMessage),
  company: z.string().max(200).optional().nullable().refine(noXss, noXssMessage),
  address1: z.string().min(2).max(500).refine(noXss, noXssMessage),
  address2: z.string().max(500).optional().nullable().refine(noXss, noXssMessage),
  city: z.string().min(1).max(150).refine(noXss, noXssMessage),
  state: z.string().max(150).optional().nullable().refine(noXss, noXssMessage),
  upazila: z.string().max(150).optional().nullable().refine(noXss, noXssMessage),
  /** Deepest area picked (upazila/thana or district); fills state/city/upazila with its names. */
  locationId: z.coerce.bigint().positive().optional().nullable(),
  postcode: z.string().max(50).optional().nullable().refine(noXss, noXssMessage),
  countryCode: z
    .string()
    .min(2)
    .max(3)
    .refine((v) => /^[A-Z]{2,3}$/.test(v), "countryCode must be 2 or 3 uppercase letters"),
  phone: z
    .string()
    .regex(BD_PHONE_RE, "Invalid BD phone number (e.g. 017XXXXXXXX or +88017XXXXXXXX)")
    .optional()
    .nullable(),
  isDefault: z.boolean().default(false),
});
export const CustomerAddressDto = BaseCustomerAddressDto;
export type CustomerAddressDto = z.infer<typeof CustomerAddressDto>;

const BaseCustomerDto = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  firstName: z.string().min(1).max(100).refine(noXss, noXssMessage),
  lastName: z.string().min(1).max(100).refine(noXss, noXssMessage),
  phone: z
    .string()
    .regex(BD_PHONE_RE, "Invalid BD phone number (e.g. 017XXXXXXXX or +88017XXXXXXXX)")
    .optional()
    .nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72)
    .regex(/[A-Z]/, "Password needs at least one uppercase letter")
    .regex(/\d/, "Password needs at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password needs at least one symbol")
    .optional(),
  isGuest: z.boolean().default(false),
  status: z.nativeEnum(CustomerStatus).default(CustomerStatus.ACTIVE),
  acceptMarketing: z.boolean().default(false),
  groupId: z.coerce.bigint().optional().nullable(),
  storeCredit: z.coerce.number().nonnegative().optional(),
  loyaltyPoints: z.coerce.number().int().nonnegative().optional(),
  addresses: z.array(BaseCustomerAddressDto).optional(),
});
export const CreateCustomerDto = BaseCustomerDto.superRefine((_v, _ctx) => {
});
export type CreateCustomerDto = z.infer<typeof CreateCustomerDto>;
export const UpdateCustomerDto = BaseCustomerDto.partial();
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerDto>;

const BaseCustomerSearchQueryDto = PaginationSchema.extend({
  status: z.nativeEnum(CustomerStatus).optional(),
  groupId: z.coerce.bigint().optional(),
  minTotalSpent: z.coerce.number().nonnegative().optional(),
  maxTotalSpent: z.coerce.number().nonnegative().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  country: z.string().min(2).max(3).optional(),
  acceptMarketing: z.coerce.boolean().optional(),
  isGuest: z.coerce.boolean().optional(),
});
export const CustomerSearchQueryDto = BaseCustomerSearchQueryDto.superRefine((v, ctx) => {
  if (v.minTotalSpent !== undefined && v.maxTotalSpent !== undefined && v.minTotalSpent > v.maxTotalSpent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minTotalSpent cannot exceed maxTotalSpent",
      path: ["minTotalSpent"],
    });
  }
  if (v.dateFrom !== undefined && v.dateTo !== undefined && v.dateFrom > v.dateTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dateFrom must be before dateTo",
      path: ["dateFrom"],
    });
  }
  if (v.search !== undefined && !noXss(v.search)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: noXssMessage,
      path: ["search"],
    });
  }
  if (v.country !== undefined && !/^[A-Z]{2,3}$/.test(v.country)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "country must be 2 or 3 uppercase letters",
      path: ["country"],
    });
  }
});
export type CustomerSearchQueryDto = z.infer<typeof CustomerSearchQueryDto>;

export const CustomerStatusTransitionDto = z.object({
  ids: z.array(z.coerce.bigint()).min(1),
  action: z.enum(["block", "unblock", "active", "marketing_opt_in", "marketing_opt_out"]),
});
export type CustomerStatusTransitionDto = z.infer<typeof CustomerStatusTransitionDto>;

export const PasswordResetRequestDto = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72)
    .regex(/[A-Z]/, "Password needs at least one uppercase letter")
    .regex(/\d/, "Password needs at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password needs at least one symbol"),
});
export type PasswordResetRequestDto = z.infer<typeof PasswordResetRequestDto>;

const BaseExportCustomersDto = PaginationSchema.extend({
  format: z.nativeEnum(ExportFormat).default(ExportFormat.CSV),
  status: z.nativeEnum(CustomerStatus).optional(),
  groupId: z.coerce.bigint().optional(),
  minTotalSpent: z.coerce.number().nonnegative().optional(),
  maxTotalSpent: z.coerce.number().nonnegative().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  country: z.string().min(2).max(3).optional(),
  acceptMarketing: z.coerce.boolean().optional(),
});
export const ExportCustomersDto = BaseExportCustomersDto.superRefine((v, ctx) => {
  if (v.minTotalSpent !== undefined && v.maxTotalSpent !== undefined && v.minTotalSpent > v.maxTotalSpent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minTotalSpent cannot exceed maxTotalSpent",
      path: ["minTotalSpent"],
    });
  }
  if (v.dateFrom !== undefined && v.dateTo !== undefined && v.dateFrom > v.dateTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dateFrom must be before dateTo",
      path: ["dateFrom"],
    });
  }
  if (v.country !== undefined && !/^[A-Z]{2,3}$/.test(v.country)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "country must be 2 or 3 uppercase letters",
      path: ["country"],
    });
  }
});
export type ExportCustomersDto = z.infer<typeof ExportCustomersDto>;

export const UpdateProfileDto = z.object({
  firstName: z.string().min(1).max(100).refine(noXss, noXssMessage).optional(),
  lastName: z.string().min(1).max(100).refine(noXss, noXssMessage).optional(),
  phone: z
    .string()
    .regex(BD_PHONE_RE, "Invalid BD phone number (e.g. 017XXXXXXXX or +88017XXXXXXXX)")
    .optional()
    .nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  acceptMarketing: z.boolean().optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;

export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72)
    .regex(/[A-Z]/, "Password needs at least one uppercase letter")
    .regex(/\d/, "Password needs at least one digit"),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>;

export const SetDefaultAddressDto = z.object({
  type: z.enum(["billing", "shipping"]),
});
export type SetDefaultAddressDto = z.infer<typeof SetDefaultAddressDto>;

export const ImportCustomersDto = z.object({
  format: z.enum(["csv", "xlsx"]).default("csv"),
  mode: z.enum(["insert", "upsert"]).default("insert"),
});
export type ImportCustomersDto = z.infer<typeof ImportCustomersDto>;
