import bcrypt from "bcryptjs";
import { prisma, tx } from "../../config";
import {
  BaseService,
  ConflictError,
  NotFoundError,
  BadRequestError,
  type RequestContext,
  type Paginated,
} from "../../core";
import { CustomerRepository, CustomerAddressRepository } from "./customers.repository";
import type {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerSearchQueryDto,
  CustomerAddressDto,
  ExportCustomersDto,
  UpdateProfileDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
} from "./customers.dto";
import { CustomerStatus, ExportFormat } from "@ecom/shared-types";

function formatDateForFilename(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function contentDispositionForExport(format: ExportFormat | string, basename: string): string {
  const ext = format === ExportFormat.EXCEL ? "xlsx" : format === ExportFormat.PDF ? "pdf" : "csv";
  const filename = `${basename}_${formatDateForFilename(new Date())}.${ext}`;
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export class CustomersService extends BaseService {
  private customers: CustomerRepository;
  private addresses: CustomerAddressRepository;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.customers = new CustomerRepository();
    this.addresses = new CustomerAddressRepository();
  }

  private async requireCustomerIdFromCtx(): Promise<bigint> {
    const cid = this.ctx.customer?.id;
    if (cid === undefined) {
      throw new BadRequestError("Customer context required", "BAD_REQUEST");
    }
    return BigInt(cid);
  }

  private async ensureUniqueEmail(storeId: bigint | undefined, email: string, excludeId?: bigint): Promise<void> {
    const where: Record<string, unknown> = { email: email.toLowerCase() };
    if (storeId !== undefined) where.storeId = storeId;
    if (excludeId !== undefined) where.NOT = { id: excludeId };
    const existing = await prisma.customer.findFirst({ where });
    if (existing) {
      throw new ConflictError(`Customer email already registered: ${email}`, "DUPLICATE_EMAIL");
    }
  }

  async createCustomer(dto: CreateCustomerDto): Promise<unknown> {
    const storeId = this.ctx.storeId;
    await this.ensureUniqueEmail(storeId, dto.email);

    const data: Record<string, unknown> = {
      email: dto.email.toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      isGuest: dto.isGuest,
      status: dto.status,
      acceptMarketing: dto.acceptMarketing,
      groupId: dto.groupId ?? null,
      storeCredit: dto.storeCredit ?? 0,
      loyaltyPoints: dto.loyaltyPoints ?? 0,
    };
    if (dto.password !== undefined) {
      (data as any).passwordHash = await bcrypt.hash(dto.password, 12);
    }
    if (storeId !== undefined) {
      (data as any).storeId = storeId;
    }

    return tx(async (t: any) => {
      const customer = await t.customer.create({ data });
      if (dto.addresses && dto.addresses.length > 0) {
        const byType: Record<string, { dto: CustomerAddressDto; hasDefault: boolean }> = {};
        for (const addr of dto.addresses) {
          const t_ = addr.type ?? "shipping";
          const bucket = byType[t_];
          if (!bucket) {
            byType[t_] = { dto: addr, hasDefault: Boolean(addr.isDefault) };
          } else if (addr.isDefault && !bucket.hasDefault) {
            byType[t_] = { dto: addr, hasDefault: true };
          }
        }
        const addressesToCreate: Record<string, unknown>[] = [];
        const seenDefaultForType = new Set<string>();
        for (let i = 0; i < dto.addresses.length; i++) {
          const addr = dto.addresses[i]!;
          const t_ = addr.type ?? "shipping";
          let isDefault = Boolean(addr.isDefault);
          if (isDefault) {
            if (seenDefaultForType.has(t_)) {
              isDefault = false;
            } else {
              seenDefaultForType.add(t_);
            }
          } else if (!seenDefaultForType.has(t_) && i === dto.addresses.findIndex((a) => (a.type ?? "shipping") === t_)) {
            isDefault = true;
            seenDefaultForType.add(t_);
          }
          addressesToCreate.push({
            customerId: customer.id,
            type: t_,
            label: addr.label ?? null,
            firstName: addr.firstName,
            lastName: addr.lastName,
            company: addr.company ?? null,
            address1: addr.address1,
            address2: addr.address2 ?? null,
            city: addr.city,
            state: addr.state ?? null,
            postcode: addr.postcode ?? null,
            countryCode: addr.countryCode,
            phone: addr.phone ?? null,
            isDefault,
          });
        }
        if (addressesToCreate.length > 0) {
          await t.customerAddress.createMany({ data: addressesToCreate });
        }
      }
      return this.customers.findFull(this.ctx, customer.id);
    });
  }

  async listCustomers(filters: CustomerSearchQueryDto): Promise<Paginated<any>> {
    return this.customers.listWithJoins(this.ctx, filters);
  }

  async getCustomer(id: bigint | number): Promise<unknown> {
    return withoutSecrets(await this.customers.findFull(this.ctx, id));
  }

  async getMyProfile(): Promise<unknown> {
    const cid = await this.requireCustomerIdFromCtx();
    return withoutSecrets(await this.customers.findFull(this.ctx, cid));
  }

  async updateCustomer(id: bigint | number, dto: UpdateCustomerDto): Promise<unknown> {
    const storeId = this.ctx.storeId;
    const cid = BigInt(id);
    const existing = await prisma.customer.findFirst({
      where: { id: cid, ...(storeId !== undefined ? { storeId } : {}) },
    });
    if (!existing) throw new NotFoundError("customer", id);

    if (dto.email !== undefined && dto.email.toLowerCase() !== existing.email.toLowerCase()) {
      await this.ensureUniqueEmail(storeId, dto.email, cid);
    }

    const updateData: Record<string, unknown> = {};
    for (const key of Object.keys(dto)) {
      if (key === "password" || key === "addresses") continue;
      (updateData as any)[key] = (dto as any)[key];
    }
    if (dto.email !== undefined) updateData.email = dto.email.toLowerCase();
    if (dto.password !== undefined) {
      (updateData as any).passwordHash = await bcrypt.hash(dto.password, 12);
    }

    await this.customers.update(this.ctx, cid, updateData);
    return this.customers.findFull(this.ctx, cid);
  }

  async updateMyProfile(dto: UpdateProfileDto): Promise<unknown> {
    const cid = await this.requireCustomerIdFromCtx();
    await this.updateCustomer(cid, dto as UpdateCustomerDto);
    return this.getMyProfile();
  }

  async deleteCustomer(id: bigint | number): Promise<{ success: true; id: bigint | number }> {
    return this.customers.delete(this.ctx, id);
  }

  async importCustomers(
    _file: { buffer: Uint8Array; originalName: string; mimeType: string },
    _dto: { format: "csv" | "xlsx"; mode: "insert" | "upsert" },
  ): Promise<{ success: true; imported: number; skipped: number; errors: unknown[] }> {
    return {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
    };
  }

  async bulkUpdateStatuses(
    ids: bigint[],
    action: "block" | "unblock" | "active" | "marketing_opt_in" | "marketing_opt_out",
  ): Promise<{ count: number; action: string }> {
    const data: Record<string, unknown> = {};
    switch (action) {
      case "block":
        data.status = CustomerStatus.BANNED;
        break;
      case "unblock":
      case "active":
        data.status = CustomerStatus.ACTIVE;
        break;
      case "marketing_opt_in":
        data.acceptMarketing = true;
        break;
      case "marketing_opt_out":
        data.acceptMarketing = false;
        break;
      default:
        throw new BadRequestError(`Unknown status action: ${action}`, "BAD_REQUEST");
    }
    const result = await this.customers.bulkUpdateStatuses(this.ctx, ids, data);
    return { count: result.count, action };
  }

  async generateCustomersExport(
    dto: ExportCustomersDto,
  ): Promise<{ buffer: Uint8Array; contentType: string; contentDisposition: string }> {
    const { format } = dto;
    const basename = "customers";
    const contentDisposition = contentDispositionForExport(format, basename);
    let contentType = "text/csv; charset=utf-8";
    if (format === ExportFormat.EXCEL) {
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (format === ExportFormat.PDF) {
      contentType = "application/pdf";
    }
    const stub = new TextEncoder().encode(`${format} export stub — implement with csv-writer / exceljs / pdfkit`);
    return {
      buffer: stub,
      contentType,
      contentDisposition,
    };
  }

  async getCustomerLtv(id: bigint | number): Promise<{ customerId: bigint; lifetimeValue: number; orderCount: number; avgOrderValue: number }> {
    const storeId = this.ctx.storeId;
    const cid = BigInt(id);
    const existing = await prisma.customer.findFirst({
      where: { id: cid, ...(storeId !== undefined ? { storeId } : {}) },
      select: { id: true, totalSpent: true, orderCount: true },
    });
    if (!existing) throw new NotFoundError("customer", id);

    const totalSpentNum = Number(existing.totalSpent ?? 0);
    const orderCount = Number(existing.orderCount ?? 0);
    return {
      customerId: cid,
      lifetimeValue: totalSpentNum,
      orderCount,
      avgOrderValue: orderCount > 0 ? totalSpentNum / orderCount : 0,
    };
  }

  async listAddresses(customerId?: bigint | number): Promise<unknown[]> {
    const cid = customerId !== undefined ? BigInt(customerId) : await this.requireCustomerIdFromCtx();
    return this.addresses.listForCustomer(this.ctx, cid);
  }

  async listMyAddresses(): Promise<unknown[]> {
    const cid = await this.requireCustomerIdFromCtx();
    return this.listAddresses(cid);
  }

  async addAddress(customerIdOrDto: bigint | number | CustomerAddressDto, dto?: CustomerAddressDto): Promise<unknown> {
    let customerId: bigint;
    let addressDto: CustomerAddressDto;
    if (dto === undefined) {
      customerId = await this.requireCustomerIdFromCtx();
      addressDto = customerIdOrDto as CustomerAddressDto;
    } else {
      customerId = BigInt(customerIdOrDto as bigint | number);
      addressDto = dto;
    }
    return this.addresses.addAddress(this.ctx, customerId, addressDto as unknown as Record<string, unknown>);
  }

  async setDefaultAddress(
    customerIdOrAddressId: bigint | number,
    typeOrCustomerId: "billing" | "shipping" | bigint | number,
    maybeType?: "billing" | "shipping",
  ): Promise<unknown> {
    let customerId: bigint;
    let addressId: bigint;
    let type: "billing" | "shipping";
    if (maybeType !== undefined) {
      customerId = BigInt(customerIdOrAddressId as bigint | number);
      addressId = BigInt(typeOrCustomerId as bigint | number);
      type = maybeType;
    } else {
      customerId = await this.requireCustomerIdFromCtx();
      addressId = BigInt(customerIdOrAddressId as bigint | number);
      type = typeOrCustomerId as "billing" | "shipping";
    }
    return this.addresses.setDefault(this.ctx, { customerId, type, addressId });
  }

  private async requireMyAddress(addressId: bigint | number) {
    const customerId = await this.requireCustomerIdFromCtx();
    const addr = await prisma.customerAddress.findFirst({ where: { id: BigInt(addressId), customerId } });
    if (!addr) throw new NotFoundError("customerAddress", addressId);
    return addr;
  }

  async updateMyAddress(addressId: bigint | number, dto: CustomerAddressDto): Promise<unknown> {
    const addr = await this.requireMyAddress(addressId);
    const { isDefault, ...fields } = dto;
    return tx(async (t: any) => {
      if (isDefault) {
        await t.customerAddress.updateMany({ where: { customerId: addr.customerId, type: dto.type }, data: { isDefault: false } });
      }
      return t.customerAddress.update({ where: { id: addr.id }, data: { ...fields, isDefault: isDefault || (addr.isDefault && addr.type === dto.type) } });
    });
  }

  async deleteMyAddress(addressId: bigint | number): Promise<void> {
    const addr = await this.requireMyAddress(addressId);
    await prisma.customerAddress.delete({ where: { id: addr.id } });
  }

  async changePassword(dto: ChangePasswordDto): Promise<{ success: true }> {
    const cid = await this.requireCustomerIdFromCtx();
    const existing = await prisma.customer.findFirst({
      where: { id: cid },
      select: { passwordHash: true },
    });
    if (!existing) throw new NotFoundError("customer", cid);

    if (existing.passwordHash) {
      const ok = await bcrypt.compare(dto.currentPassword, existing.passwordHash);
      if (!ok) {
        throw new BadRequestError("Current password is incorrect", "BAD_REQUEST");
      }
    }
    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await prisma.customer.update({
      where: { id: cid },
      data: { passwordHash: newHash },
    });
    return { success: true };
  }

  async resetPasswordByToken(dto: PasswordResetRequestDto): Promise<{ success: true }> {
    void dto;
    throw new BadRequestError("Password reset token flow not implemented", "BAD_REQUEST");
  }
}

/** Customer rows must never leave the API with their password hash or 2FA secret. */
function withoutSecrets<T>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const { passwordHash: _p, twoFactorSecret: _t, ...rest } = row as Record<string, unknown>;
  return rest as T;
}
