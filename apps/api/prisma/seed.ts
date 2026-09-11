import { PrismaClient, PlanType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROUNDS = 12;

/**
 * 1. Create platform-level super admin (PlatformAdmin table - NO storeId)
 * Login: super@admin.ecom.local / Super@dmin123!
 */
async function seedPlatformSuperAdmin() {
  console.log("🔑 Seeding Platform Super Admin...");
  const email = "super@admin.ecom.local";
  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log("  ✅ Platform Super Admin already exists, skipping.");
    return;
  }
  const passwordHash = await bcrypt.hash("Super@dmin123!", ROUNDS);
  await prisma.platformAdmin.create({
    data: {
      email,
      passwordHash,
      name: "Platform Owner",
      role: "super_owner",
    },
  });
  console.log("  ✅ Created Platform Super Admin:", email);
}

/**
 * 2. Seed baseline pricing Plans (BASIC / PRO / ENTERPRISE) and create Fashion BD Store
 * Fashion BD: slug="fashion-bd", domains: localhost:3000 (storefront) + localhost:3001 (store admin)
 */
async function seedFashionBDStore() {
  console.log("🛒 Seeding Plans + Fashion BD Store...");

  let basicPlan = await prisma.plan.findUnique({ where: { name: "BASIC" } });
  if (!basicPlan) {
    basicPlan = await prisma.plan.create({
      data: {
        name: "BASIC",
        type: PlanType.BASIC,
        priceMonthly: "29.00",
        priceYearly: "290.00",
        features: {
          maxProducts: 500,
          staffUsers: 5,
          storageGB: 25,
          enableDropshipping: false,
          enableSubscriptions: false,
          customDomain: true,
        },
      },
    });
    console.log("  ✅ Created BASIC plan");
  }

  let proPlan = await prisma.plan.findUnique({ where: { name: "PRO" } });
  if (!proPlan) {
    proPlan = await prisma.plan.create({
      data: {
        name: "PRO",
        type: PlanType.PRO,
        priceMonthly: "99.00",
        priceYearly: "990.00",
        features: {
          maxProducts: 10000,
          staffUsers: 50,
          storageGB: 200,
          enableDropshipping: true,
          enableSubscriptions: true,
          customDomain: true,
        },
      },
    });
    console.log("  ✅ Created PRO plan");
  }

  let enterprisePlan = await prisma.plan.findUnique({ where: { name: "ENTERPRISE" } });
  if (!enterprisePlan) {
    enterprisePlan = await prisma.plan.create({
      data: {
        name: "ENTERPRISE",
        type: PlanType.ENTERPRISE,
        priceMonthly: "499.00",
        priceYearly: "4990.00",
        features: {
          maxProducts: 0,
          staffUsers: 0,
          storageGB: 1000,
          enableDropshipping: true,
          enableSubscriptions: true,
          customDomain: true,
        },
      },
    });
    console.log("  ✅ Created ENTERPRISE plan");
  }

  const storeSlug = "fashion-bd";
  let store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        name: "Fashion Bangladesh",
        slug: storeSlug,
        planId: proPlan.id,
        status: "active",
      },
    });
    console.log(`  ✅ Created Store: ${store.name} (slug=${store.slug}, id=${store.id})`);
  } else {
    console.log(`  ✅ Store already exists: ${store.name}`);
  }

  const fashionDomain = "localhost:3000";
  const adminDomain = "localhost:3001";
  const existingStorefrontDomain = await prisma.domain.findUnique({
    where: { hostname: fashionDomain },
  });
  if (!existingStorefrontDomain) {
    await prisma.domain.create({
      data: {
        storeId: store.id,
        hostname: fashionDomain,
        type: "storefront",
        primary: true,
      },
    });
    console.log(`  ✅ Domain created: ${fashionDomain} (storefront)`);
  }
  const existingAdminDomain = await prisma.domain.findUnique({
    where: { hostname: adminDomain },
  });
  if (!existingAdminDomain) {
    await prisma.domain.create({
      data: {
        storeId: store.id,
        hostname: adminDomain,
        type: "admin",
        primary: false,
      },
    });
    console.log(`  ✅ Domain created: ${adminDomain} (store admin)`);
  }

  // Seed 1-to-1 settings defaults for the store so admin UI has sensible values
  const gsExisting = await prisma.storeGeneralSetting.findUnique({
    where: { storeId: store.id },
  });
  if (!gsExisting) {
    await prisma.storeGeneralSetting.create({
      data: {
        storeId: store.id,
        tagline: "Fashion reimagined, delivered across Bangladesh",
        emailFrom: "no-reply@fashionbd.local",
        emailFromName: "Fashion Bangladesh",
        timezone: "Asia/Dhaka",
        dateFormat: "DD/MM/YYYY",
        countryCode: "BD",
      },
    });
  }
  const locExisting = await prisma.storeLocalizationSetting.findUnique({
    where: { storeId: store.id },
  });
  if (!locExisting) {
    await prisma.storeLocalizationSetting.create({
      data: {
        storeId: store.id,
        defaultCurrency: "BDT",
        allowedCurrencies: ["BDT", "USD"],
        defaultLanguage: "bn",
        allowedLanguages: ["en", "bn"],
      },
    });
  }
  const brandExisting = await prisma.storeBrandSetting.findUnique({
    where: { storeId: store.id },
  });
  if (!brandExisting) {
    await prisma.storeBrandSetting.create({ data: { storeId: store.id } });
  }
  const layoutExisting = await prisma.storeLayoutSetting.findUnique({
    where: { storeId: store.id },
  });
  if (!layoutExisting) {
    await prisma.storeLayoutSetting.create({ data: { storeId: store.id } });
  }
  const emailExisting = await prisma.storeEmailSetting.findUnique({
    where: { storeId: store.id },
  });
  if (!emailExisting) {
    await prisma.storeEmailSetting.create({
      data: {
        storeId: store.id,
        fromAddress: "no-reply@fashionbd.local",
        fromName: "Fashion Bangladesh",
      },
    });
  }
  const seoExisting = await prisma.storeSeoSetting.findUnique({
    where: { storeId: store.id },
  });
  if (!seoExisting) {
    await prisma.storeSeoSetting.create({
      data: {
        storeId: store.id,
        homeSeoTitle: "Fashion Bangladesh - Best Fashion Shop",
        homeMetaDescription: "Shop the latest trends in Bangladesh fashion with home delivery.",
      },
    });
  }
  const secExisting = await prisma.storeSecuritySetting.findUnique({
    where: { storeId: store.id },
  });
  if (!secExisting) {
    await prisma.storeSecuritySetting.create({ data: { storeId: store.id } });
  }

  // Seed default Currency + Language rows
  const bdtExists = await prisma.currency.findFirst({
    where: { storeId: store.id, code: "BDT" },
  });
  if (!bdtExists) {
    await prisma.currency.create({
      data: {
        storeId: store.id,
        code: "BDT",
        symbol: "৳",
        name: "Bangladeshi Taka",
        rate: "1.000000",
        enabled: true,
        isDefault: undefined as any,
      },
    });
  }
  const bnLangExists = await prisma.language.findFirst({
    where: { storeId: store.id, code: "bn" },
  });
  if (!bnLangExists) {
    await prisma.language.create({
      data: {
        storeId: store.id,
        code: "bn",
        name: "Bengali",
        nativeName: "বাংলা",
        isDefault: true,
      },
    });
  }

  // Default Payment Gateway configs (disabled by default except COD)
  const defaultGateways = [
    { code: "cod", name: "Cash On Delivery", enabled: true, sortOrder: 1 },
    { code: "bkash", name: "bKash", sortOrder: 2 },
    { code: "nagad", name: "Nagad", sortOrder: 3 },
    { code: "rocket", name: "Rocket", sortOrder: 4 },
    { code: "sslcommerz", name: "SSLCommerz", sortOrder: 5 },
    { code: "stripe", name: "Stripe", sortOrder: 10 },
    { code: "bank_transfer", name: "Bank Transfer", sortOrder: 20 },
  ] as const;
  for (const g of defaultGateways) {
    const ex = await prisma.paymentGatewayConfig.findFirst({
      where: { storeId: store.id, code: g.code },
    });
    if (!ex) {
      await prisma.paymentGatewayConfig.create({
        data: { storeId: store.id, ...g },
      });
      console.log(`  ✅ Payment gateway ${g.code} (${g.name}) default row added`);
    }
  }

  // Default shipping zone + COD/Flat rate
  const zoneEx = await prisma.shippingZone.findFirst({
    where: { storeId: store.id, name: "Dhaka Metro" },
  });
  let zoneId = zoneEx?.id;
  if (!zoneEx) {
    const zone = await prisma.shippingZone.create({
      data: {
        storeId: store.id,
        name: "Dhaka Metro",
        countries: ["BD"],
        states: ["Dhaka"],
      },
    });
    zoneId = zone.id;
    await prisma.shippingMethod.create({
      data: {
        zoneId: zone.id,
        code: "flat_rate",
        name: "Flat Rate (Dhaka)",
        baseCost: "120.00",
        perItemCost: "20.00",
      },
    });
    console.log(`  ✅ Shipping Zone "Dhaka Metro" + Flat Rate added`);
  }

  // Standard Tax Class + 15% BD VAT
  const stdTax = await prisma.taxClass.findFirst({
    where: { storeId: store.id, name: "Standard" },
  });
  if (!stdTax) {
    const tc = await prisma.taxClass.create({
      data: { storeId: store.id, name: "Standard" },
    });
    await prisma.taxRate.create({
      data: {
        taxClassId: tc.id,
        countryCode: "BD",
        rate: "15.00",
        name: "VAT",
      },
    });
    console.log("  ✅ Tax Class Standard (15% BD VAT) added");
  }

  // ===== CATALOG BASELINE: Categories + Brands + Attributes + Terms =====
  const fashionId = store.id;

  // 2 Root Categories: Women -> Dresses; Men -> Shirts
  const womenCatEx = await prisma.category.findFirst({
    where: { storeId: fashionId, slug: "women" },
  });
  let womenCatId = womenCatEx?.id;
  if (!womenCatEx) {
    const women = await prisma.category.create({
      data: {
        storeId: fashionId,
        name: "Women",
        slug: "women",
        description: "Women's Fashion Collection Bangladesh",
        displayMode: "products",
        sortOrder: 0,
        isActive: true,
        menuIncluded: true,
      },
    });
    womenCatId = women.id;
    const dresses = await prisma.category.create({
      data: {
        storeId: fashionId,
        parentId: womenCatId,
        name: "Dresses",
        slug: "dresses",
        description: "Dresses — 3-piece, sari, kurti, lehenga",
        displayMode: "products",
        sortOrder: 0,
        isActive: true,
      },
    });
    console.log(`  ✅ Category tree: Women (id=${womenCatId}) → Dresses (id=${dresses.id})`);
  }
  const menCatEx = await prisma.category.findFirst({
    where: { storeId: fashionId, slug: "men" },
  });
  let menCatId = menCatEx?.id;
  if (!menCatEx) {
    const men = await prisma.category.create({
      data: {
      storeId: fashionId,
      name: "Men",
      slug: "men",
      description: "Men's Fashion Collection BD",
      displayMode: "products",
      sortOrder: 1,
      isActive: true,
      menuIncluded: true,
      },
    });
    menCatId = men.id;
    const shirts = await prisma.category.create({
      data: {
      storeId: fashionId,
        parentId: menCatId,
        name: "Shirts",
        slug: "shirts",
        description: "Formal / casual shirts",
        displayMode: "products",
        sortOrder: 0,
        isActive: true,
      },
    });
    console.log(`  ✅ Category tree: Men (id=${menCatId}) → Shirts (id=${shirts.id})`);
  }

  // 2 Brands: Richman, Cats Eye
  const brands = [
    { slug: "richman", name: "Richman", websiteUrl: "https://richmanbd.com", sortOrder: 0, description: "Premium men's fashion brand Bangladesh" },
    { slug: "cats-eye", name: "Cats Eye", websiteUrl: "https://catseye.com.bd", sortOrder: 1, description: "Luxury retail fashion — suits, sarees, leather goods" },
  ] as const;
  for (const b of brands) {
    const ex = await prisma.brand.findFirst({ where: { storeId: fashionId, slug: b.slug } });
    if (!ex) {
      await prisma.brand.create({ data: { storeId: fashionId, ...b, isActive: true, seoTitle: `${b.name} — Buy Online Bangladesh`, metaDesc: `Shop ${b.name} products at Fashion BD. Authentic, fast delivery.` } });
      console.log(`  ✅ Brand added: ${b.name}`);
    }
  }

  // 2 Attributes + Terms: Size (S/M/L/XL/XXL/Free) Color (Black/White/Red/Blue)
  async function upsertAttrWithTerms(slug: string, name: string, type: string, terms: Array<{ slug: string; name: string; value?: string; swatchUrl?: string }>) {
    let attr = await prisma.attribute.findFirst({ where: { storeId: fashionId, slug } });
    if (!attr) {
      attr = await prisma.attribute.create({
        data: {
          storeId: fashionId, slug, name, type, isFilterable: true, isActive: true, sortOrder: slug === "size" ? 0 : 1 },
      });
      console.log(`  ✅ Attribute created: ${name} (slug=${slug})`);
    }
    let sortIdx = 0;
    for (const t of terms) {
      const ex2 = await prisma.attributeTerm.findFirst({ where: { attributeId: attr!.id, slug: t.slug } });
      if (!ex2) {
        await prisma.attributeTerm.create({
          data: { attributeId: attr!.id, name: t.name, slug: t.slug, value: t.value ?? t.name, sortOrder: sortIdx, swatchUrl: t.swatchUrl ?? undefined },
        });
      }
      sortIdx++;
    }
    return attr;
  }
  await upsertAttrWithTerms("size", "Size", "select", [
    { slug: "s", name: "S (Small)" },
    { slug: "m", name: "M (Medium)" },
    { slug: "l", name: "L (Large)" },
    { slug: "xl", name: "XL" },
    { slug: "xxl", name: "XXL" },
    { slug: "free", name: "Free Size" },
  ]);
  await upsertAttrWithTerms("color", "Color", "color", [
    { slug: "black", name: "Black" },
    { slug: "white", name: "White" },
    { slug: "red", name: "Red" },
    { slug: "blue", name: "Blue" },
  ]);

  console.log("  ✅ Catalog baseline (2 cats, 2 brands, 2 attributes + 10 terms) added.");

  console.log("  ✅ Store + Settings baseline seeded.");
  return store;
}

/**
 * 3. Seed the 10 built-in Roles + PermissionAssignments for the Fashion BD store
 * Owner, Product Manager, Order Manager, Customer Support, Marketing, Content, Finance, Shipper, Reports, Viewer
 */
async function seedDefaultRolesAndPerms(storeId: bigint) {
  console.log("🔐 Seeding 10 default roles + permissions...");

  const ROLE_PERMS: Record<string, string[]> = {
    owner: ["*"],
    product_manager: [
      "products.*",
      "categories.*",
      "brands.*",
      "attributes.*",
      "collections.*",
      "inventory.read",
      "inventory.update",
      "media.*",
      "suppliers.*",
    ],
    order_manager: [
      "orders.read",
      "orders.update",
      "orders.statusChange",
      "shipments.*",
      "invoices.read",
      "invoices.create",
      "refunds.*",
      "returns.*",
      "abandoned_carts.read",
      "abandoned_carts.update",
    ],
    customer_support: [
      "customers.read",
      "customers.update",
      "customers.notes",
      "orders.read",
      "reviews.*",
      "tickets.*",
      "returns.read",
      "returns.update",
    ],
    marketing: [
      "coupons.*",
      "flash_sales.*",
      "banners.*",
      "gift_cards.*",
      "affiliates.read",
      "affiliates.update",
      "abandoned_carts.read",
      "email_templates.read",
      "email_templates.update",
      "notifications.send",
    ],
    content: [
      "pages.*",
      "blog.*",
      "faqs.*",
      "menus.*",
      "themes.read",
      "themes.update",
      "homepage_sections.*",
      "page_builder.*",
    ],
    finance: [
      "orders.read",
      "invoices.*",
      "refunds.read",
      "reports.*",
      "payment_gateways.read",
      "payouts.*",
      "billing.read",
      "billing.update",
    ],
    shipper: [
      "orders.read",
      "orders.statusChange",
      "shipments.create",
      "shipments.update",
      "shipments.print",
      "orders.export",
    ],
    reports: ["reports.*", "orders.read", "customers.read", "products.read"],
    viewer: ["dashboard.read", "orders.read", "products.read", "customers.read"],
  };

  for (const [slug, perms] of Object.entries(ROLE_PERMS)) {
    const ex = await prisma.role.findFirst({ where: { storeId, slug } });
    let roleId = ex?.id;
    if (!ex) {
      const titleCased = slug
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const created = await prisma.role.create({
        data: {
          storeId,
          slug,
          name: titleCased,
          isSystem: true,
        },
      });
      roleId = created.id;
      console.log(`  ✅ Role created: ${titleCased}`);
    } else {
      console.log(`  🟰 Role exists: ${ex.name}, skipping`);
    }

    const existingPerms = await prisma.permissionAssignment.findMany({
      where: { roleId },
      select: { permission: true },
    });
    const set = new Set(existingPerms.map((r) => r.permission));
    const toAdd = perms.filter((p) => !set.has(p));
    if (toAdd.length) {
      await prisma.permissionAssignment.createMany({
        data: toAdd.map((p) => ({ roleId: roleId!, permission: p })),
      });
      console.log(`    + Granted ${toAdd.length} permission(s) to ${slug}`);
    }
  }

  return prisma.role.findFirstOrThrow({ where: { storeId, slug: "owner" } });
}

/**
 * 4. Seed the initial Store Owner AdminUser for Fashion BD
 * Login: owner@fashionbd.local / Owner@123!
 * Bound to Fashion BD store + Owner role
 */
async function seedStoreOwner(storeId: bigint, ownerRoleId: bigint) {
  console.log("👤 Seeding Fashion BD Store Owner...");
  const email = "owner@fashionbd.local";
  const ex = await prisma.adminUser.findUnique({
    where: { storeId_email: { storeId, email } },
  });
  if (ex) {
    console.log("  ✅ Owner already exists:", email);
    return;
  }
  const passwordHash = await bcrypt.hash("Owner@123!", ROUNDS);
  await prisma.adminUser.create({
    data: {
      storeId,
      email,
      passwordHash,
      name: "Fashion BD Owner",
      roleId: ownerRoleId,
      phone: "+8801700000001",
      status: "active",
    },
  });
  console.log("  ✅ Store Owner created:", email, "(pass: Owner@123!)");
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║      E-Commerce Platform — Database Seed     ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  try {
    await seedPlatformSuperAdmin();
    const store = await seedFashionBDStore();
    const ownerRole = await seedDefaultRolesAndPerms(store.id);
    await seedStoreOwner(store.id, ownerRole.id);

    console.log("\n✅ All seed operations completed successfully!");
    console.log("");
    console.log("🔑 Platform Super Admin: super@admin.ecom.local / Super@dmin123!");
    console.log("🏪 Store: Fashion BD (slug=fashion-bd, id=" + store.id + ")");
    console.log("👤 Store Owner:     owner@fashionbd.local / Owner@123!");
    console.log("🛍️  Storefront URL:  http://localhost:3000");
    console.log("🎛️  Store Admin URL: http://localhost:3001");
    console.log("🛡️  Super Admin URL: http://localhost:3002");
    process.exit(0);
  } catch (err) {
    console.error("❌ SEED FAILED:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
