/**
 * Store admin settings: store details (general + address), the signed-in admin's profile,
 * and password change. Values map onto the existing Store / StoreGeneralSetting /
 * StoreLocalizationSetting columns; keys with no column are not stored.
 */
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../config";
import { ctrl, envelope, BadRequestError, NotFoundError, type RequestContext } from "../../core";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";

type Req = Request & { ctx: RequestContext };

const opt = z.string().max(255).optional().nullable();

const GeneralDto = z.object({
  storeName: z.string().min(2).max(120).optional(),
  storeDescription: z.string().max(255).optional().nullable(),
  defaultCurrency: z.string().length(3).toUpperCase().optional(),
  timezone: z.string().max(64).optional(),
  dateFormat: z.string().max(32).optional(),
  defaultWeightUnit: z.enum(["kg", "g", "lb", "oz"]).optional(),
  defaultDimensionUnit: z.enum(["cm", "in"]).optional(),
});

const AddressDto = z.object({
  addressLine1: opt,
  addressLine2: opt,
  country: z.string().min(2).max(3).toUpperCase().optional().nullable(),
  state: opt,
  city: opt,
  postcode: opt,
  phone: z.string().max(32).optional().nullable(),
});

const ProfileDto = z.object({
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
  displayName: z.string().max(120).optional(),
  phone: z.string().max(32).optional().nullable(),
  avatar: z.string().max(500).optional().nullable(),
});

const PasswordDto = z
  .object({
    oldPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72)
      .regex(/[A-Z]/, "Password needs at least one uppercase letter")
      .regex(/\d/, "Password needs at least one digit")
      .regex(/[^A-Za-z0-9]/, "Password needs at least one symbol"),
    confirmNewPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

const storeIdOf = (req: Req): bigint => {
  if (req.ctx.storeId === undefined) throw new BadRequestError("Store not resolved", "TENANT_NOT_RESOLVED");
  return BigInt(req.ctx.storeId);
};

/** StoreGeneralSetting has required email columns, so create it with sensible defaults when missing. */
async function upsertGeneral(storeId: bigint, data: Record<string, unknown>) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  await prisma.storeGeneralSetting.upsert({
    where: { storeId },
    update: data,
    create: { storeId, emailFrom: `no-reply@${store.slug}.local`, emailFromName: store.name, ...data },
  });
}

async function readGeneral(storeId: bigint) {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    include: { generalSettings: true, localizationSettings: true },
  });
  const g = store.generalSettings;
  return {
    general: {
      storeName: store.name,
      storeSlug: store.slug,
      storeDescription: g?.tagline ?? "",
      defaultCurrency: store.localizationSettings?.defaultCurrency ?? "BDT",
      timezone: g?.timezone ?? "Asia/Dhaka",
      dateFormat: g?.dateFormat ?? "DD/MM/YYYY",
      defaultWeightUnit: g?.weightUnit ?? "kg",
      defaultDimensionUnit: g?.dimensionUnit ?? "cm",
    },
    address: {
      addressLine1: g?.addressLine1 ?? "",
      addressLine2: g?.addressLine2 ?? "",
      country: g?.countryCode ?? "BD",
      state: g?.state ?? "",
      city: g?.city ?? "",
      postcode: g?.postalCode ?? "",
      phone: g?.phone ?? "",
    },
  };
}

const profileOf = (u: { id: bigint; name: string; email: string; phone: string | null; avatarUrl: string | null; twoFactorSecret: string | null; role: { name: string } | null }) => {
  const [firstName, ...rest] = u.name.trim().split(/\s+/);
  return {
    id: u.id,
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    displayName: u.name,
    email: u.email,
    phone: u.phone ?? "",
    role: u.role?.name ?? "",
    avatar: u.avatarUrl,
    twoFactorEnabled: !!u.twoFactorSecret,
  };
};

const SECTIONS = ["general", "address"] as const;

export const adminSettingsRouter = Router();

adminSettingsRouter.get(
  "/profile",
  authMiddleware("admin"),
  ctrl(async (req: Req, res: Response) => {
    const u = await prisma.adminUser.findFirst({
      where: { id: req.ctx.admin!.id, storeId: storeIdOf(req) },
      include: { role: { select: { name: true } } },
    });
    if (!u) throw new NotFoundError("admin user");
    envelope(res, { status: 200, data: profileOf(u) });
  }),
);

adminSettingsRouter.put(
  "/profile",
  authMiddleware("admin"),
  validate({ body: ProfileDto }),
  ctrl(async (req: Req, res: Response) => {
    const dto = req.body as z.infer<typeof ProfileDto>;
    const storeId = storeIdOf(req);
    const existing = await prisma.adminUser.findFirst({ where: { id: req.ctx.admin!.id, storeId } });
    if (!existing) throw new NotFoundError("admin user");
    const name =
      dto.displayName?.trim() || [dto.firstName, dto.lastName].filter(Boolean).join(" ").trim() || existing.name;
    const u = await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        name,
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.avatar !== undefined ? { avatarUrl: dto.avatar || null } : {}),
      },
      include: { role: { select: { name: true } } },
    });
    envelope(res, { status: 200, data: profileOf(u), message: "Profile updated" });
  }),
);

adminSettingsRouter.put(
  "/password",
  authMiddleware("admin"),
  validate({ body: PasswordDto }),
  ctrl(async (req: Req, res: Response) => {
    const dto = req.body as z.infer<typeof PasswordDto>;
    const u = await prisma.adminUser.findFirst({ where: { id: req.ctx.admin!.id, storeId: storeIdOf(req) } });
    if (!u) throw new NotFoundError("admin user");
    const ok = await bcrypt.compare(dto.oldPassword, u.passwordHash ?? "");
    // 400, not 401: a 401 would make the admin client try a token refresh and retry.
    if (!ok) throw new BadRequestError("Current password is incorrect", "AUTH_CREDENTIALS_INVALID");
    await prisma.adminUser.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) },
    });
    envelope(res, { status: 200, data: { success: true }, message: "Password changed" });
  }),
);

adminSettingsRouter.get(
  "/:section",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("settings.view"),
  ctrl(async (req: Req, res: Response) => {
    const section = String(req.params.section);
    if (!(SECTIONS as readonly string[]).includes(section)) {
      // Media / legal / … have no storage yet: return empty so the page renders its defaults.
      envelope(res, { status: 200, data: {} });
      return;
    }
    const all = await readGeneral(storeIdOf(req));
    envelope(res, { status: 200, data: all[section as (typeof SECTIONS)[number]] });
  }),
);

adminSettingsRouter.put(
  "/:section",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("settings.edit"),
  ctrl(async (req: Req, res: Response) => {
    const storeId = storeIdOf(req);
    const section = String(req.params.section);
    if (section === "general") {
      const dto = GeneralDto.parse(req.body);
      if (dto.storeName) await prisma.store.update({ where: { id: storeId }, data: { name: dto.storeName } });
      await upsertGeneral(storeId, {
        ...(dto.storeDescription !== undefined ? { tagline: dto.storeDescription || null } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.dateFormat ? { dateFormat: dto.dateFormat } : {}),
        ...(dto.defaultWeightUnit ? { weightUnit: dto.defaultWeightUnit } : {}),
        ...(dto.defaultDimensionUnit ? { dimensionUnit: dto.defaultDimensionUnit } : {}),
      });
      if (dto.defaultCurrency) {
        await prisma.storeLocalizationSetting.upsert({
          where: { storeId },
          update: { defaultCurrency: dto.defaultCurrency },
          create: { storeId, defaultCurrency: dto.defaultCurrency },
        });
      }
    } else if (section === "address") {
      const dto = AddressDto.parse(req.body);
      await upsertGeneral(storeId, {
        addressLine1: dto.addressLine1 || null,
        addressLine2: dto.addressLine2 || null,
        countryCode: dto.country || null,
        state: dto.state || null,
        city: dto.city || null,
        postalCode: dto.postcode || null,
        phone: dto.phone || null,
      });
    } else {
      throw new BadRequestError(`"${section}" settings are not stored yet`, "BAD_REQUEST");
    }
    const all = await readGeneral(storeId);
    envelope(res, { status: 200, data: all[section], message: "Settings saved" });
  }),
);
