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

  // Default shipping zone + 8 carriers x 2 levels (standard/express) for Dhaka Metro
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

    await prisma.shippingMethod.createMany({
      data: [
        { zoneId: zone.id, code: "pathao_std", name: "Pathao Standard", baseCost: "120.00", freeFromSubtotal: "10000.00", costRules: JSON.stringify({ perKgExtra: 50, minimumCost: 120 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: zone.id, code: "pathao_exp", name: "Pathao Express (Same Day)", baseCost: "220.00", costRules: JSON.stringify({ perKgExtra: 80, minimumCost: 220 }), deliveryEstimateMinDays: 0, deliveryEstimateMaxDays: 1 },
        { zoneId: zone.id, code: "redx_std", name: "RedX Standard", baseCost: "150.00", freeFromSubtotal: "12000.00", costRules: JSON.stringify({ perKgExtra: 60, minimumCost: 150 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: zone.id, code: "redx_exp", name: "RedX Express (Next Day)", baseCost: "250.00", costRules: JSON.stringify({ perKgExtra: 90, minimumCost: 250 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 1 },
        { zoneId: zone.id, code: "paperfly_std", name: "Paperfly Standard", baseCost: "130.00", freeFromSubtotal: "11000.00", costRules: JSON.stringify({ perKgExtra: 55, minimumCost: 130 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 3 },
        { zoneId: zone.id, code: "paperfly_exp", name: "Paperfly Express (Next Day)", baseCost: "230.00", costRules: JSON.stringify({ perKgExtra: 85, minimumCost: 230 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 1 },
        { zoneId: zone.id, code: "sundarban_std", name: "Sundarban Courier Standard", baseCost: "140.00", freeFromSubtotal: "12500.00", costRules: JSON.stringify({ perKgExtra: 50, minimumCost: 140 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: zone.id, code: "sundarban_exp", name: "Sundarban Courier Express (Next Day)", baseCost: "240.00", costRules: JSON.stringify({ perKgExtra: 80, minimumCost: 240 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 1 },
        { zoneId: zone.id, code: "ecourier_std", name: "eCourier Standard", baseCost: "110.00", freeFromSubtotal: "9500.00", costRules: JSON.stringify({ perKgExtra: 45, minimumCost: 110 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: zone.id, code: "ecourier_exp", name: "eCourier Express (Same Day)", baseCost: "200.00", costRules: JSON.stringify({ perKgExtra: 70, minimumCost: 200 }), deliveryEstimateMinDays: 0, deliveryEstimateMaxDays: 1 },
        { zoneId: zone.id, code: "sa_std", name: "SA Paribahan Standard", baseCost: "145.00", freeFromSubtotal: "11500.00", costRules: JSON.stringify({ perKgExtra: 50, minimumCost: 145 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 3 },
        { zoneId: zone.id, code: "sa_exp", name: "SA Paribahan Express (Next Day)", baseCost: "250.00", costRules: JSON.stringify({ perKgExtra: 80, minimumCost: 250 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 1 },
        { zoneId: zone.id, code: "steadfast_std", name: "Steadfast Standard", baseCost: "115.00", freeFromSubtotal: "10000.00", costRules: JSON.stringify({ perKgExtra: 45, minimumCost: 115 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: zone.id, code: "steadfast_exp", name: "Steadfast Express (Same Day)", baseCost: "210.00", costRules: JSON.stringify({ perKgExtra: 70, minimumCost: 210 }), deliveryEstimateMinDays: 0, deliveryEstimateMaxDays: 1 },
        { zoneId: zone.id, code: "flat_rate", name: "Generic Flat Rate Standard", baseCost: "120.00", freeFromSubtotal: "10000.00", costRules: JSON.stringify({ perKgExtra: 40, minimumCost: 120 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: zone.id, code: "flat_rate_express", name: "Generic Flat Rate Express", baseCost: "200.00", costRules: JSON.stringify({ perKgExtra: 60, minimumCost: 200 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
      ],
    });
    console.log(`  ✅ Shipping Zone "Dhaka Metro" + 16 methods (8 carriers x std/exp) added`);
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

  // Reduced Rate Tax Class + Export Exempt 0%
  const reducedTax = await prisma.taxClass.findFirst({
    where: { storeId: store.id, name: "Reduced Rate" },
  });
  if (!reducedTax) {
    const tc = await prisma.taxClass.create({
      data: { storeId: store.id, name: "Reduced Rate" },
    });
    await prisma.taxRate.create({
      data: {
        taxClassId: tc.id,
        countryCode: "*",
        rate: "0.00",
        name: "Export Exempt",
      },
    });
    console.log("  ✅ Tax Class Reduced Rate (0% Export Exempt) added");
  }

  // ===== CATALOG BASELINE: Categories + Brands + Attributes + Terms =====
  const storeId_324 = store.id;

  // 2 Root Categories: Women -> Dresses; Men -> Shirts
  const womenCatEx = await prisma.category.findFirst({
    where: { storeId: storeId_324, slug: "women" },
  });
  let womenCatId = womenCatEx?.id;
  if (!womenCatEx) {
    const women = await prisma.category.create({
      data: {
        storeId: storeId_324,
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
        storeId: storeId_324,
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
    where: { storeId: storeId_324, slug: "men" },
  });
  let menCatId = menCatEx?.id;
  if (!menCatEx) {
    const men = await prisma.category.create({
      data: {
      storeId: storeId_324,
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
      storeId: storeId_324,
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
    const ex = await prisma.brand.findFirst({ where: { storeId: storeId_324, slug: b.slug } });
    if (!ex) {
      await prisma.brand.create({ data: { storeId: storeId_324, ...b, isActive: true, seoTitle: `${b.name} — Buy Online Bangladesh`, metaDesc: `Shop ${b.name} products at Fashion BD. Authentic, fast delivery.` } });
      console.log(`  ✅ Brand added: ${b.name}`);
    }
  }

  // 2 Attributes + Terms: Size (S/M/L/XL/XXL/Free) Color (Black/White/Red/Blue)
  async function upsertAttrWithTerms(slug: string, name: string, type: string, terms: Array<{ slug: string; name: string; value?: string; swatchUrl?: string }>) {
    let attr = await prisma.attribute.findFirst({ where: { storeId: storeId_324, slug } });
    if (!attr) {
      attr = await prisma.attribute.create({
        data: {
          storeId: storeId_324, slug, name, type, isFilterable: true, isActive: true, sortOrder: slug === "size" ? 0 : 1 },
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

  // ===== ORDERS BASELINE: Shipping zones (rest-of-BD), Customer Cart, 5 CartItems =====
  // 1) Rest-of-BD Shipping Zone (Dhaka Metro already added above lines 279-302)
  let restZone = await prisma.shippingZone.findFirst({ where: { storeId: store.id, name: "Rest of Bangladesh" } });
  if (!restZone) {
    restZone = await prisma.shippingZone.create({
      data: {
        storeId: store.id,
        name: "Rest of Bangladesh",
        countries: ["BD"],
        states: ["Chittagong", "Sylhet", "Rajshahi", "Rangpur", "Barisal", "Khulna", "Mymensingh", "Comilla", "Narayanganj", "Gazipur"],
        postcodes: [],
      },
    });
    await prisma.shippingMethod.createMany({
      data: [
        { zoneId: restZone.id, code: "pathao_rob_std", name: "Pathao Standard (RHOB)", baseCost: "180.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 60, minimumCost: 180 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "pathao_rob_exp", name: "Pathao Express (RHOB)", baseCost: "220.00", costRules: JSON.stringify({ perKgExtra: 90, minimumCost: 220 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: restZone.id, code: "redx_rob_std", name: "RedX Standard (RHOB)", baseCost: "200.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 70, minimumCost: 200 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "redx_rob_exp", name: "RedX Express (RHOB)", baseCost: "240.00", costRules: JSON.stringify({ perKgExtra: 100, minimumCost: 240 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: restZone.id, code: "paperfly_rob_std", name: "Paperfly Standard (RHOB)", baseCost: "190.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 65, minimumCost: 190 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "paperfly_rob_exp", name: "Paperfly Express (RHOB)", baseCost: "230.00", costRules: JSON.stringify({ perKgExtra: 95, minimumCost: 230 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: restZone.id, code: "sundarban_rob_std", name: "Sundarban Courier Standard (RHOB)", baseCost: "170.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 55, minimumCost: 170 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "sundarban_rob_exp", name: "Sundarban Courier Express (RHOB)", baseCost: "210.00", costRules: JSON.stringify({ perKgExtra: 85, minimumCost: 210 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: restZone.id, code: "ecourier_rob_std", name: "eCourier Standard (RHOB)", baseCost: "175.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 55, minimumCost: 175 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "ecourier_rob_exp", name: "eCourier Express (RHOB)", baseCost: "215.00", costRules: JSON.stringify({ perKgExtra: 85, minimumCost: 215 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: restZone.id, code: "sa_rob_std", name: "SA Paribahan Standard (RHOB)", baseCost: "160.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 50, minimumCost: 160 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "sa_rob_exp", name: "SA Paribahan Express (RHOB)", baseCost: "200.00", costRules: JSON.stringify({ perKgExtra: 80, minimumCost: 200 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: restZone.id, code: "steadfast_rob_std", name: "Steadfast Standard (RHOB)", baseCost: "185.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 60, minimumCost: 185 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "steadfast_rob_exp", name: "Steadfast Express (RHOB)", baseCost: "225.00", costRules: JSON.stringify({ perKgExtra: 90, minimumCost: 225 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
        { zoneId: restZone.id, code: "flat_rate_rob", name: "Generic Flat Rate Standard (RHOB)", baseCost: "180.00", freeFromSubtotal: "15000.00", costRules: JSON.stringify({ perKgExtra: 50, minimumCost: 180 }), deliveryEstimateMinDays: 2, deliveryEstimateMaxDays: 3 },
        { zoneId: restZone.id, code: "flat_rate_rob_express", name: "Generic Flat Rate Express (RHOB)", baseCost: "220.00", costRules: JSON.stringify({ perKgExtra: 80, minimumCost: 220 }), deliveryEstimateMinDays: 1, deliveryEstimateMaxDays: 2 },
      ],
    });
    console.log(`  ✅ Shipping Zone "Rest of Bangladesh" + 16 methods (8 carriers x std/exp) added`);
  }

  // 1b) International / Outside Bangladesh Shipping Zone
  let intlZone = await prisma.shippingZone.findFirst({ where: { storeId: store.id, name: "International / Outside Bangladesh" } });
  if (!intlZone) {
    intlZone = await prisma.shippingZone.create({
      data: {
        storeId: store.id,
        name: "International / Outside Bangladesh",
        countries: ["US", "GB", "CA", "AU", "SG", "MY", "IN", "PK", "SAE", "AE"],
      },
    });
    await prisma.shippingMethod.createMany({
      data: [
        { zoneId: intlZone.id, code: "dhl_intl", name: "DHL Express International", baseCost: "3500.00", costRules: JSON.stringify({ perKgExtra: 2500, minimumCost: 3500 }), deliveryEstimateMinDays: 5, deliveryEstimateMaxDays: 10 },
        { zoneId: intlZone.id, code: "air_freight_intl", name: "Standard Air Freight International", baseCost: "1800.00", costRules: JSON.stringify({ perKgExtra: 1200, minimumCost: 1800 }), deliveryEstimateMinDays: 10, deliveryEstimateMaxDays: 21 },
      ],
    });
    console.log(`  ✅ Shipping Zone "International / Outside Bangladesh" + 2 methods added`);
  }

  // Look up shirts category + Richman brand for product fallback seed reference
  const shirtsCat = await prisma.category.findFirst({ where: { storeId: store.id, slug: "shirts" } });
  const richman = await prisma.brand.findFirst({ where: { storeId: store.id, slug: "richman" } });
  const catsEye = await prisma.brand.findFirst({ where: { storeId: store.id, slug: "cats-eye" } });
  // Fake product rows (5) — always seeded so reviews/flash sale have products — SIMPLE products, taxClass=Standard (from 304-321)
  const standardTaxClass = await prisma.taxClass.findFirst({ where: { storeId: store.id, name: "Standard" } });
  const productSeedList = [
    { slug: "richman-formal-cotton-shirt-navy", name: "Richman Formal Cotton Shirt — Navy", brandId: richman?.id, price: "3290.00" },
    { slug: "richman-slim-fit-shirt-white", name: "Richman Slim Fit Oxford Shirt — White", brandId: richman?.id, price: "2890.00" },
    { slug: "cats-eye-casual-denim-shirt", name: "Cats Eye Casual Denim Shirt — Indigo", brandId: catsEye?.id, price: "3690.00" },
    { slug: "cats-eye-premium-linen-shirt", name: "Cats Eye Premium Linen Shirt — Beige", brandId: catsEye?.id, price: "4490.00" },
    { slug: "richman-party-wear-satin-shirt", name: "Richman Party Wear Satin Shirt — Black", brandId: richman?.id, price: "3990.00" },
  ] as const;
  const insertedPIds: bigint[] = [];
  for (const p of productSeedList) {
    const pEx = await prisma.product.findFirst({ where: { storeId: store.id, slug: p.slug } });
    if (!pEx) {
      const newP = await prisma.product.create({
        data: {
          storeId: store.id,
          type: "SIMPLE",
          name: p.name,
          slug: p.slug,
          brandId: p.brandId ?? undefined,
          taxClassId: standardTaxClass?.id ?? undefined,
          regularPrice: p.price,
          description: `${p.name} — 100% cotton/denim/linen. Authentic ${(p.brandId === richman?.id ? "Richman" : "Cats Eye")}.`,
          status: "published",
          manageStock: true,
          stockQty: 50,
          categoryIds: undefined as any,
        } as any,
      });
      insertedPIds.push(newP.id);
      // Link to Shirts category via ProductCategory pivot if we have both
      if (shirtsCat) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "ProductCategory" ("productId", "categoryId", "sortOrder") VALUES ($1::bigint, $2::bigint, 0) ON CONFLICT DO NOTHING`,
            Number(newP.id),
            Number(shirtsCat.id),
          );
        } catch {}
      }
    } else {
      insertedPIds.push(pEx.id);
    }
  }

  // 2) Fashion BD Customer Fatema — if already exists, use her id to link cart
  const fatemaEx = await prisma.customer.findFirst({ where: { storeId: store.id, email: "fatema@fashionbd.xyz" } });
  if (fatemaEx) {
    // 3) Cart for Fatema if missing
    const cartEx = await prisma.cart.findFirst({ where: { storeId: store.id, customerId: fatemaEx.id }, orderBy: { createdAt: "desc" } });
    if (!cartEx) {
      const cart = await prisma.cart.create({
        data: {
          storeId: store.id,
          customerId: fatemaEx.id,
          token: `cart-seed-fashionbd-${Date.now()}`,
          currencyCode: "BDT",
        },
      });
      // 5 CartItem rows for Fatema cart
      const qtyMap = [2, 1, 1, 2, 1];
      let lineIdx = 0;
      for (const pid of insertedPIds) {
        const p = await prisma.product.findUniqueOrThrow({ where: { id: pid } });
        const qty = qtyMap[lineIdx] ?? 1;
        const lineTotal = (Number(p.regularPrice ?? 0) * qty).toFixed(2);
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: pid,
            quantity: qty,
            unitPrice: p.regularPrice ?? "0",
            lineTotal,
            lineTax: (Number(lineTotal) * 0.15).toFixed(2),
          },
        });
        lineIdx++;
      }
      console.log(`  ✅ Cart baseline for Fatema@fashionbd.xyz: cartId=${cart.id} 5 items (Richman/CatsEye shirts)`);
    }
  } else {
    console.log("  ℹ️  Skipped cart baseline (customer fatema@fashionbd.xyz not seeded yet — runs after seedCustomers)");
  }

  console.log("  ✅ Orders baseline (Rest of BD shipping zone + Fatema cart 5 items) added.");

  // ===== BATCH #8 BASELINE: Customer Groups, 20 demo customers, 2 coupons, 1 flash sale, 30 reviews =====
  const demoStoreId = store.id;

  const generalGroupEx = await prisma.customerGroup.findFirst({
    where: { storeId: demoStoreId, name: "General" },
  });
  if (!generalGroupEx) {
    await prisma.customerGroup.create({
      data: {
        storeId: demoStoreId,
        name: "General",
        discountPercent: "0.00",
        isSystem: true,
      },
    });
    console.log("  ✅ CustomerGroup: General (system, 0%) added");
  }

  const vipGroupEx = await prisma.customerGroup.findFirst({
    where: { storeId: demoStoreId, name: "VIP" },
  });
  let vipGroupId = vipGroupEx?.id;
  if (!vipGroupEx) {
    const vip = await prisma.customerGroup.create({
      data: {
        storeId: demoStoreId,
        name: "VIP",
        discountPercent: "5.00",
        minimumSpend: "5000.00",
        isSystem: false,
      },
    });
    vipGroupId = vip.id;
    console.log("  ✅ CustomerGroup: VIP (5% min 5000 BDT) added");
  }

  const passwordHash = bcrypt.hashSync("Customer@123", 10);
  const customerEmails: string[] = Array.from({ length: 20 }, (_, i) => `c${i + 1}@fashionbd.xyz`);
  const firstNames = [
    "Aarav", "Ayesha", "Sakib", "Nusrat", "Rafid", "Tahiya", "Mahir", "Zara", "Ishrak", "Maliha",
    "Tanvir", "Sadia", "Rakin", "Fariha", "Jubaer", "Nowrin", "Wasif", "Sumaiya", "Mehedi", "Hridita",
  ];
  const lastNames = [
    "Ahmed", "Rahman", "Khan", "Islam", "Chowdhury", "Hossain", "Uddin", "Akter", "Karim", "Begum",
    "Hasan", "Rana", "Sultana", "Mia", "Khatun", "Bhuiyan", "Ali", "Sharma", "Saha", "Das",
  ];
  const BD_PHONE_RE = /^(\+?8801|01)[3-9]\d{8}$/;
  const demoCustomerIds: bigint[] = [];

  for (let i = 0; i < 20; i++) {
    const email = customerEmails[i]!;
    const custEx = await prisma.customer.findFirst({ where: { storeId: demoStoreId, email } });
    let cid: bigint;
    if (!custEx) {
      const isVIP = i < 2;
      const customer = await prisma.customer.create({
        data: {
          storeId: demoStoreId,
          email,
          passwordHash,
          firstName: firstNames[i]!,
          lastName: lastNames[i]!,
          phone: `017${String(10000000 + i).padStart(8, "0")}`,
          status: "ACTIVE",
          acceptMarketing: i % 2 === 0,
          groupId: isVIP ? vipGroupId : undefined,
          storeCredit: (i * 100).toFixed(2),
          loyaltyPoints: i * 50,
        },
      });
      cid = customer.id;
      console.log(`  ✅ Demo customer ${email} added (VIP=${i < 2})`);
    } else {
      cid = custEx.id;
    }
    demoCustomerIds.push(cid);

    if (i < 5) {
      const addrEx = await prisma.customerAddress.findFirst({
        where: { customerId: cid, type: "shipping" },
      });
      if (!addrEx) {
        await prisma.customerAddress.create({
          data: {
            customerId: cid,
            type: "shipping",
            label: i < 3 ? "Home" : "Office",
            firstName: firstNames[i]!,
            lastName: lastNames[i]!,
            address1: `House ${i + 1}, Road ${i + 2}, Dhanmondi ${i + 1}`,
            city: "Dhaka",
            state: "Dhaka",
            countryCode: "BD",
            phone: `017${String(20000000 + i).padStart(8, "0")}`,
            isDefault: true,
          },
        });
      }
    } else if (i < 10) {
      const addrEx = await prisma.customerAddress.findFirst({
        where: { customerId: cid, type: "shipping" },
      });
      if (!addrEx) {
        await prisma.customerAddress.create({
          data: {
            customerId: cid,
            type: "shipping",
            label: "Home",
            firstName: firstNames[i]!,
            lastName: lastNames[i]!,
            address1: `Flat 4B, Kazir Dewri, GEC Mor`,
            city: "Chattogram",
            state: "Chattogram",
            countryCode: "BD",
            phone: `018${String(30000000 + i).padStart(8, "0")}`,
            isDefault: true,
          },
        });
      }
    }
  }

  const fatemaCust = await prisma.customer.findFirst({
    where: { storeId: demoStoreId, email: "fatema@fashionbd.xyz" },
  });
  if (fatemaCust) demoCustomerIds.push(fatemaCust.id);

  const couponSeed = [
    {
      code: "WELCOME10",
      description: "Welcome 10% off for new customers — min 3000 BDT",
      type: "PERCENTAGE",
      amount: "10",
      isActive: true,
      newCustomersOnly: true,
      minSubtotal: "3000.00",
    },
    {
      code: "FLAT500",
      description: "Flat 500 BDT off — min 5000 BDT, once per customer",
      type: "FIXED_CART",
      amount: "500",
      isActive: true,
      minSubtotal: "5000.00",
      perCustomerLimit: 1,
    },
  ] as const;

  for (const c of couponSeed) {
    const couponEx = await prisma.coupon.findFirst({
      where: { storeId: demoStoreId, code: c.code },
    });
    if (!couponEx) {
      await prisma.coupon.create({
        data: {
          storeId: demoStoreId,
          code: c.code,
          description: c.description,
          type: c.type as any,
          amount: c.amount,
          isActive: c.isActive,
          newCustomersOnly: (c as any).newCustomersOnly ?? false,
          minSubtotal: c.minSubtotal,
          perCustomerLimit: (c as any).perCustomerLimit ?? null,
        },
      });
      console.log(`  ✅ Coupon ${c.code} added`);
    }
  }

  const richmanBrand = await prisma.brand.findFirst({ where: { storeId: demoStoreId, slug: "richman" } });

  const flashSaleSlug = "richman-20pc-2026";
  const flashSaleEx = await prisma.flashSale.findFirst({
    where: { storeId: demoStoreId, slug: flashSaleSlug },
  });
  let flashSaleId: bigint | undefined = flashSaleEx?.id;
  if (!flashSaleEx) {
    const flashSale = await prisma.flashSale.create({
      data: {
        storeId: demoStoreId,
        name: "Fall Richman 2026",
        slug: flashSaleSlug,
        startsAt: new Date("2026-09-13T00:00:00"),
        endsAt: new Date("2026-09-20T23:59:59"),
        discountPercent: "20",
        bannerTitle: "Richman Shirts 20% OFF",
        bannerSubtitle: "7 days only on all Richman formal/casual shirts",
        bannerCtaText: "Shop Now",
        bannerCtaUrl: "/collections/richman-shirts",
        isActive: true,
      },
    });
    flashSaleId = flashSale.id;
    console.log(`  ✅ Flash Sale "Fall Richman 2026" added (13-20 Sep 2026)`);
  }

  const richmanProducts = await prisma.product.findMany({
    where: {
      storeId: demoStoreId,
      brandId: richmanBrand?.id,
    },
    take: 5,
  });
  if (flashSaleId && richmanProducts.length > 0) {
    for (let i = 0; i < richmanProducts.length; i++) {
      const p = richmanProducts[i]!;
      const itemEx = await prisma.flashSaleItem.findFirst({
        where: {
          flashSaleId: flashSaleId!,
          productId: p.id,
        },
      });
      if (!itemEx) {
        const productPrice = Number(p.regularPrice ?? 0);
        const salePrice = productPrice > 0 ? (productPrice * 0.8).toFixed(2) : null;
        await prisma.flashSaleItem.create({
          data: {
            flashSaleId: flashSaleId!,
            productId: p.id,
            discountPct: "20",
            salePrice,
            stockLimit: 20,
            sortOrder: i,
          },
        });
      }
    }
    console.log(`  ✅ FlashSaleItem rows linked (${richmanProducts.length} Richman products)`);
  }

  const allCatalogProducts = await prisma.product.findMany({
    where: { storeId: demoStoreId },
    select: { id: true },
  });
  const productIdsForReviews = allCatalogProducts.map((p) => p.id);

  const reviewBodies = [
    "Nice product. Fits well!",
    "Great quality for the price. Highly recommend.",
    "Excellent fabric and stitching. Would buy again.",
    "Good value. Shipping was fast too.",
    "Perfect size and color. Exactly as described.",
    "Very happy with the purchase. 5 stars!",
    "Comfortable and stylish. Good brand.",
    "Satisfactory. Will shop here again.",
  ];

  const deliveredOrders = await prisma.order.findMany({
    where: { storeId: demoStoreId, status: { in: ["DELIVERED", "COMPLETED"] } },
    select: { id: true, customerId: true, items: { select: { productId: true } } },
  });

  const verifiedOrdersByCustomer = new Map<string, bigint[]>();
  for (const o of deliveredOrders) {
    const key = String(o.customerId);
    if (!verifiedOrdersByCustomer.has(key)) verifiedOrdersByCustomer.set(key, []);
    verifiedOrdersByCustomer.get(key)!.push(o.id);
  }

  for (let i = 0; i < 30; i++) {
    const randomProductIdx = Math.floor(Math.random() * productIdsForReviews.length);
    const productId = productIdsForReviews[randomProductIdx]!;
    const randomCustomerIdx = Math.floor(Math.random() * demoCustomerIds.length);
    const customerId = demoCustomerIds[randomCustomerIdx]!;
    const rating = 3 + Math.floor(Math.random() * 3);
    const status = i < 10 ? "pending" : "approved";

    const custKey = String(customerId);
    const ordersForCust = verifiedOrdersByCustomer.get(custKey) ?? [];
    const chosenOrderId = ordersForCust.length > 0
      ? (Math.random() < 0.5 ? ordersForCust[Math.floor(Math.random() * ordersForCust.length)] : undefined)
      : undefined;
    const verified = chosenOrderId !== undefined ? true : Math.random() < 0.4;

    const reviewEx = await prisma.review.findFirst({
      where: {
        storeId: demoStoreId,
        customerId,
        productId,
        orderId: chosenOrderId ?? null,
      },
    });
    if (!reviewEx) {
      await prisma.review.create({
        data: {
          storeId: demoStoreId,
          productId,
          customerId,
          orderId: chosenOrderId ?? null,
          rating,
          title: rating === 5 ? "Amazing!" : rating === 4 ? "Great" : rating === 3 ? "Okay" : "Review",
          body: reviewBodies[i % reviewBodies.length],
          status,
          verified,
        },
      });
    }
  }
  console.log("  ✅ 30 reviews seeded (10 pending, 20 approved)");

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
