"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Save,
  RefreshCw,
  Loader2,
  Store,
  MapPin,
  ImageIcon,
  FileText,
  Upload,
  CircleDot,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Select,
  SelectItem,
  Checkbox,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui";
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  type StoreGeneralSettings,
  type StoreAddressSettings,
  type StoreMediaSettings,
  type StoreLegalSettings,
} from "@/lib/features/settings/settings-api-slice";

const generalSchema = z.object({
  storeName: z.string().min(1, "Store name is required").max(100),
  storeLegalName: z.string().max(200).optional().or(z.literal("")),
  storeSlug: z.string().min(3, "Slug must be 3+ chars").max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens"),
  storeDescription: z.string().max(255).optional().or(z.literal("")),
  industry: z.string().max(80).optional().or(z.literal("")),
  defaultCurrency: z.string().default("BDT"),
  currencyPosition: z.enum(["left", "right", "left_space", "right_space"]).default("left"),
  defaultWeightUnit: z.enum(["kg", "g", "lb", "oz"]).default("kg"),
  defaultDimensionUnit: z.enum(["cm", "in"]).default("cm"),
  timezone: z.string().default("Asia/Dhaka"),
  dateFormat: z.string().default("YYYY-MM-DD"),
  timeFormat: z.string().default("HH:mm"),
  weekStartsOn: z.enum(["monday", "sunday"]).default("sunday"),
});

const addressSchema = z.object({
  addressLine1: z.string().max(200).optional().or(z.literal("")),
  addressLine2: z.string().max(200).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(80).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  postcode: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  vatNumber: z.string().max(50).optional().or(z.literal("")),
  companyNumber: z.string().max(50).optional().or(z.literal("")),
});

const mediaSchema = z.object({
  thumbnailWidth: z.coerce.number().int().min(16).max(2048).default(150),
  thumbnailHeight: z.coerce.number().int().min(16).max(2048).default(150),
  mediumWidth: z.coerce.number().int().min(16).max(4096).default(600),
  mediumHeight: z.coerce.number().int().min(16).max(4096).default(600),
  largeWidth: z.coerce.number().int().min(16).max(5000).default(1200),
  largeHeight: z.coerce.number().int().min(16).max(5000).default(1200),
  uploadQuality: z.coerce.number().int().min(0).max(100).default(82),
  webpCompression: z.boolean().default(true),
  watermarkEnabled: z.boolean().default(false),
  watermarkPosition: z
    .enum([
      "top_left",
      "top_center",
      "top_right",
      "middle_left",
      "middle_center",
      "middle_right",
      "bottom_left",
      "bottom_center",
      "bottom_right",
    ])
    .default("bottom_right"),
  watermarkImage: z.string().optional().or(z.literal("")),
  watermarkOpacity: z.coerce.number().min(0).max(100).default(60),
});

const legalSchema = z.object({
  refundPolicy: z.string().max(20000).optional().or(z.literal("")),
  privacyPolicy: z.string().max(20000).optional().or(z.literal("")),
  termsOfService: z.string().max(20000).optional().or(z.literal("")),
  shippingPolicy: z.string().max(20000).optional().or(z.literal("")),
  cookieNoticeEnabled: z.boolean().default(false),
  cookieNoticeMessage: z.string().max(500).optional().or(z.literal("")),
  cookieNoticeButtonText: z.string().max(60).optional().or(z.literal("")),
});

type GeneralForm = z.infer<typeof generalSchema>;
type AddressForm = z.infer<typeof addressSchema>;
type MediaForm = z.infer<typeof mediaSchema>;
type LegalForm = z.infer<typeof legalSchema>;

const INDUSTRIES = [
  "",
  "Fashion & Apparel",
  "Electronics",
  "Grocery & Foods",
  "Home & Furniture",
  "Beauty & Cosmetics",
  "Health & Wellness",
  "Toys & Games",
  "Books & Media",
  "Sports & Outdoors",
  "Automotive",
  "Jewelry & Accessories",
  "Handmade & Crafts",
  "Digital Products",
  "Services",
  "Other",
];

const COUNTRIES = [
  "",
  "Bangladesh",
  "India",
  "Pakistan",
  "Sri Lanka",
  "Nepal",
  "Maldives",
  "Bhutan",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "Malaysia",
  "United Arab Emirates",
  "Saudi Arabia",
  "Germany",
  "France",
  "Japan",
  "China",
];

const TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Colombo",
  "Asia/Kathmandu",
  "Asia/Singapore",
  "Asia/Dubai",
  "Asia/Riyadh",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Australia/Sydney",
  "UTC",
];

const DATE_FORMATS = [
  { v: "YYYY-MM-DD", l: "2024-12-31" },
  { v: "DD-MM-YYYY", l: "31-12-2024" },
  { v: "MM/DD/YYYY", l: "12/31/2024" },
  { v: "DD/MM/YYYY", l: "31/12/2024" },
  { v: "MMMM D, YYYY", l: "December 31, 2024" },
  { v: "D MMM, YYYY", l: "31 Dec, 2024" },
];

const TIME_FORMATS = [
  { v: "HH:mm", l: "14:30 (24h)" },
  { v: "hh:mm A", l: "02:30 PM" },
  { v: "HH:mm:ss", l: "14:30:00 (24h)" },
  { v: "hh:mm:ss A", l: "02:30:00 PM" },
];

const CURRENCIES = [
  { code: "BDT", label: "৳ Bangladeshi Taka" },
  { code: "USD", label: "$ US Dollar" },
  { code: "EUR", label: "€ Euro" },
  { code: "GBP", label: "£ Pound Sterling" },
  { code: "INR", label: "₹ Indian Rupee" },
  { code: "PKR", label: "Rs Pakistan Rupee" },
  { code: "LKR", label: "Rs Sri Lanka" },
  { code: "NPR", label: "Rs Nepali Rupee" },
  { code: "AED", label: "د.إ UAE Dirham" },
  { code: "SAR", label: "ر.س Saudi Riyal" },
  { code: "MYR", label: "RM Malaysian Ringgit" },
  { code: "SGD", label: "S$ Singapore Dollar" },
  { code: "JPY", label: "¥ Japanese Yen" },
  { code: "CNY", label: "¥ Chinese Yuan" },
  { code: "CAD", label: "C$ Canadian Dollar" },
  { code: "AUD", label: "A$ Australian Dollar" },
];

const WM_POSITIONS = [
  { v: "top_left", label: "Top Left" },
  { v: "top_center", label: "Top Center" },
  { v: "top_right", label: "Top Right" },
  { v: "middle_left", label: "Middle Left" },
  { v: "middle_center", label: "Center" },
  { v: "middle_right", label: "Middle Right" },
  { v: "bottom_left", label: "Bottom Left" },
  { v: "bottom_center", label: "Bottom Center" },
  { v: "bottom_right", label: "Bottom Right" },
] as const;

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState<string>("general");
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);

  const { data: generalData, isLoading: generalLoading } = useGetSettingsQuery("general");
  const { data: addressData, isLoading: addressLoading } = useGetSettingsQuery("address");
  const { data: mediaData, isLoading: mediaLoading } = useGetSettingsQuery("media");
  const { data: legalData, isLoading: legalLoading } = useGetSettingsQuery("legal");

  const [updateSettings, updateLoading] = useUpdateSettingsMutation();

  const generalMethods = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      storeName: "",
      storeLegalName: "",
      storeSlug: "",
      storeDescription: "",
      industry: "",
      defaultCurrency: "BDT",
      currencyPosition: "left",
      defaultWeightUnit: "kg",
      defaultDimensionUnit: "cm",
      timezone: "Asia/Dhaka",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH:mm",
      weekStartsOn: "sunday",
    },
  });
  const addressMethods = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      addressLine1: "",
      addressLine2: "",
      country: "Bangladesh",
      state: "",
      city: "",
      postcode: "",
      phone: "",
      vatNumber: "",
      companyNumber: "",
    },
  });
  const mediaMethods = useForm<MediaForm>({
    resolver: zodResolver(mediaSchema),
    defaultValues: {
      thumbnailWidth: 150,
      thumbnailHeight: 150,
      mediumWidth: 600,
      mediumHeight: 600,
      largeWidth: 1200,
      largeHeight: 1200,
      uploadQuality: 82,
      webpCompression: true,
      watermarkEnabled: false,
      watermarkPosition: "bottom_right",
      watermarkImage: "",
      watermarkOpacity: 60,
    },
  });
  const legalMethods = useForm<LegalForm>({
    resolver: zodResolver(legalSchema),
    defaultValues: {
      refundPolicy: "",
      privacyPolicy: "",
      termsOfService: "",
      shippingPolicy: "",
      cookieNoticeEnabled: false,
      cookieNoticeMessage: "We use cookies to enhance your browsing experience.",
      cookieNoticeButtonText: "Accept",
    },
  });

  const { reset: resetGeneral, control: gCtl, watch: gWatch } = generalMethods;
  const { reset: resetAddress, control: aCtl } = addressMethods;
  const { reset: resetMedia, control: mCtl, watch: mWatch, setValue: mSet } = mediaMethods;
  const { reset: resetLegal, control: lCtl, watch: lWatch, setValue: lSet } = legalMethods;

  const descLen = gWatch("storeDescription")?.length ?? 0;
  const refundLen = lWatch("refundPolicy")?.split(/\s+/).filter(Boolean).length ?? 0;
  const privacyLen = lWatch("privacyPolicy")?.split(/\s+/).filter(Boolean).length ?? 0;
  const tosLen = lWatch("termsOfService")?.split(/\s+/).filter(Boolean).length ?? 0;
  const shipLen = lWatch("shippingPolicy")?.split(/\s+/).filter(Boolean).length ?? 0;
  const cookieMsgLen = lWatch("cookieNoticeMessage")?.length ?? 0;
  const watermarkEnabled = mWatch("watermarkEnabled");
  const watermarkPosition = mWatch("watermarkPosition");
  const watermarkOpacity = mWatch("watermarkOpacity");

  useEffect(() => {
    if (generalData) {
      const g = generalData as StoreGeneralSettings;
      resetGeneral({
        storeName: g.storeName ?? "",
        storeLegalName: g.storeLegalName ?? "",
        storeSlug: g.storeSlug ?? "",
        storeDescription: g.storeDescription ?? "",
        industry: g.industry ?? "",
        defaultCurrency: g.defaultCurrency ?? "BDT",
        currencyPosition: g.currencyPosition ?? "left",
        defaultWeightUnit: g.defaultWeightUnit ?? "kg",
        defaultDimensionUnit: g.defaultDimensionUnit ?? "cm",
        timezone: g.timezone ?? "Asia/Dhaka",
        dateFormat: g.dateFormat ?? "YYYY-MM-DD",
        timeFormat: g.timeFormat ?? "HH:mm",
        weekStartsOn: g.weekStartsOn ?? "sunday",
      });
    }
    if (addressData) {
      const a = addressData as StoreAddressSettings;
      resetAddress({
        addressLine1: a.addressLine1 ?? "",
        addressLine2: a.addressLine2 ?? "",
        country: a.country ?? "",
        state: a.state ?? "",
        city: a.city ?? "",
        postcode: a.postcode ?? "",
        phone: a.phone ?? "",
        vatNumber: a.vatNumber ?? "",
        companyNumber: a.companyNumber ?? "",
      });
    }
    if (mediaData) {
      const m = mediaData as StoreMediaSettings;
      resetMedia({
        thumbnailWidth: m.thumbnailWidth ?? 150,
        thumbnailHeight: m.thumbnailHeight ?? 150,
        mediumWidth: m.mediumWidth ?? 600,
        mediumHeight: m.mediumHeight ?? 600,
        largeWidth: m.largeWidth ?? 1200,
        largeHeight: m.largeHeight ?? 1200,
        uploadQuality: m.uploadQuality ?? 82,
        webpCompression: m.webpCompression ?? true,
        watermarkEnabled: m.watermarkEnabled ?? false,
        watermarkPosition: m.watermarkPosition ?? "bottom_right",
        watermarkImage: m.watermarkImage ?? "",
        watermarkOpacity: m.watermarkOpacity ?? 60,
      });
      setWatermarkPreview(m.watermarkImage ?? null);
    }
    if (legalData) {
      const l = legalData as StoreLegalSettings;
      resetLegal({
        refundPolicy: l.refundPolicy ?? "",
        privacyPolicy: l.privacyPolicy ?? "",
        termsOfService: l.termsOfService ?? "",
        shippingPolicy: l.shippingPolicy ?? "",
        cookieNoticeEnabled: l.cookieNoticeEnabled ?? false,
        cookieNoticeMessage: l.cookieNoticeMessage ?? "",
        cookieNoticeButtonText: l.cookieNoticeButtonText ?? "",
      });
    }
  }, [generalData, addressData, mediaData, legalData, resetGeneral, resetAddress, resetMedia, resetLegal]);

  const handleWatermarkFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result);
      setWatermarkPreview(r);
      mSet("watermarkImage", r, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  const saveSection = async (section: "general" | "address" | "media" | "legal") => {
    try {
      let values: any;
      if (section === "general") {
        values = await generalMethods.handleSubmit((d) => d)();
      } else if (section === "address") {
        values = await addressMethods.handleSubmit((d) => d)();
      } else if (section === "media") {
        values = await mediaMethods.handleSubmit((d) => d)();
      } else {
        values = await legalMethods.handleSubmit((d) => d)();
      }
      await updateSettings({ section, values }).unwrap();
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved.`);
    } catch (e: any) {
      toast.error(e?.data?.message || `Failed to save ${section} settings.`);
    }
  };

  const saving = updateLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Store General Settings
          </CardTitle>
          <CardDescription>
            Configure identity, currency, units, legal content, and defaults that apply across your storefront.
          </CardDescription>
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger
                value="general"
                onClick={() => setActiveTab("general")}
                className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
              >
                <Store className="h-4 w-4 mr-1.5" /> General
              </TabsTrigger>
              <TabsTrigger
                value="address"
                onClick={() => setActiveTab("address")}
                className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
              >
                <MapPin className="h-4 w-4 mr-1.5" /> Address
              </TabsTrigger>
              <TabsTrigger
                value="media"
                onClick={() => setActiveTab("media")}
                className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
              >
                <ImageIcon className="h-4 w-4 mr-1.5" /> Media
              </TabsTrigger>
              <TabsTrigger
                value="legal"
                onClick={() => setActiveTab("legal")}
                className="data-[active=true]:!bg-background data-[active=true]:!text-foreground"
              >
                <FileText className="h-4 w-4 mr-1.5" /> Legal
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="general">
            <TabsContent value="general">
              <FormProvider {...generalMethods}>
                <Form
                  onSubmit={generalMethods.handleSubmit(() => saveSection("general"))}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={gCtl}
                      name="storeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="storeLegalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Legal Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="storeSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Slug</FormLabel>
                          <FormControl>
                            <Input {...field} className="font-mono lowercase" />
                          </FormControl>
                          <FormDescription>URL-friendly lowercase slug.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              {INDUSTRIES.map((i) => (
                                <SelectItem key={i || "_"} value={i || ""}>
                                  {i || "Select industry..."}
                                </SelectItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={gCtl}
                    name="storeDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} maxLength={255} {...field} />
                        </FormControl>
                        <FormDescription>
                          <div className="flex justify-between">
                            <span>Shown in meta tags and store listings.</span>
                            <span className={descLen > 250 ? "text-red-500" : ""}>
                              {descLen}/255
                            </span>
                          </div>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={gCtl}
                      name="defaultCurrency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Currency</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              {CURRENCIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="currencyPosition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency Position</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectItem value="left">Left (৳100)</SelectItem>
                              <SelectItem value="right">Right (100৳)</SelectItem>
                              <SelectItem value="left_space">Left with space (৳ 100)</SelectItem>
                              <SelectItem value="right_space">Right with space (100 ৳)</SelectItem>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              {TIMEZONES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="defaultWeightUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Weight Unit</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectItem value="kg">Kilogram (kg)</SelectItem>
                              <SelectItem value="g">Gram (g)</SelectItem>
                              <SelectItem value="lb">Pound (lb)</SelectItem>
                              <SelectItem value="oz">Ounce (oz)</SelectItem>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="defaultDimensionUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dimension Unit</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectItem value="cm">Centimeter (cm)</SelectItem>
                              <SelectItem value="in">Inch (in)</SelectItem>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="weekStartsOn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Week Starts On</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectItem value="sunday">Sunday</SelectItem>
                              <SelectItem value="monday">Monday</SelectItem>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="dateFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date Format</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              {DATE_FORMATS.map((d) => (
                                <SelectItem key={d.v} value={d.v}>
                                  {d.l}
                                </SelectItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={gCtl}
                      name="timeFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Format</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              {TIME_FORMATS.map((t) => (
                                <SelectItem key={t.v} value={t.v}>
                                  {t.l}
                                </SelectItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <SectionActions
                    section="general"
                    loading={saving || generalLoading}
                    onSave={() => saveSection("general")}
                  />
                </Form>
              </FormProvider>
            </TabsContent>

            <TabsContent value="address">
              <FormProvider {...addressMethods}>
                <Form
                  onSubmit={addressMethods.handleSubmit(() => saveSection("address"))}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={aCtl}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Street, house, building..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Apartment, suite, unit..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              {COUNTRIES.map((c) => (
                                <SelectItem key={c || "_"} value={c || ""}>
                                  {c || "Select country..."}
                                </SelectItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Division / State</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Dhaka, Chattogram..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>District / City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="postcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postcode</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="vatNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT / Tax Registration Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={aCtl}
                      name="companyNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Registration Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <SectionActions
                    section="address"
                    loading={saving || addressLoading}
                    onSave={() => saveSection("address")}
                  />
                </Form>
              </FormProvider>
            </TabsContent>

            <TabsContent value="media">
              <FormProvider {...mediaMethods}>
                <Form
                  onSubmit={mediaMethods.handleSubmit(() => saveSection("media"))}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <SizeField label="Thumbnail" wName="thumbnailWidth" hName="thumbnailHeight" control={mCtl} />
                    <SizeField label="Medium" wName="mediumWidth" hName="mediumHeight" control={mCtl} />
                    <SizeField label="Large" wName="largeWidth" hName="largeHeight" control={mCtl} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={mCtl}
                      name="uploadQuality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex justify-between">
                            Upload Quality <span className="text-slate-500 font-normal">{field.value}%</span>
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={field.value}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                className="flex-1 accent-primary"
                              />
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                className="w-24"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>JPEG / WebP compression quality.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-start gap-2 pt-8">
                      <Controller
                        control={mCtl}
                        name="webpCompression"
                        render={({ field }) => (
                          <>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(v) => field.onChange(v)}
                            />
                            <div>
                              <Label className="text-sm font-normal">
                                Auto-convert to WebP
                              </Label>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Smaller file sizes, good for page speed.
                              </p>
                            </div>
                          </>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                      <Controller
                        control={mCtl}
                        name="watermarkEnabled"
                        render={({ field }) => (
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(v)}
                          />
                        )}
                      />
                      <div>
                        <Label className="font-medium">Image Watermarks</Label>
                        <p className="text-xs text-slate-500">
                          Stamp every product image with your brand mark.
                        </p>
                      </div>
                    </div>

                    {watermarkEnabled && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-slate-500">Watermark Image</Label>
                          <div className="relative h-28 rounded-md border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-white dark:bg-slate-900">
                            {watermarkPreview ? (
                              <>
                                <img src={watermarkPreview} alt="watermark" className="max-h-full max-w-full object-contain p-2" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWatermarkPreview(null);
                                    mSet("watermarkImage", "", { shouldDirty: true });
                                  }}
                                  className="absolute top-1 right-1 text-xs text-slate-500 hover:text-red-600 px-1"
                                >
                                  remove
                                </button>
                              </>
                            ) : (
                              <label className="cursor-pointer text-center text-sm text-slate-500 hover:text-foreground transition-colors">
                                <Upload className="h-6 w-6 mx-auto mb-1 opacity-60" />
                                <span className="underline underline-offset-2">Upload PNG</span>
                                <input
                                  type="file"
                                  accept="image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleWatermarkFile(f);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                        <FormField
                          control={mCtl}
                          name="watermarkPosition"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Position</FormLabel>
                              <FormControl>
                                <div className="grid grid-cols-3 gap-1 p-1 rounded-md border bg-background">
                                  {WM_POSITIONS.map((p) => (
                                    <button
                                      key={p.v}
                                      type="button"
                                      onClick={() => field.onChange(p.v)}
                                      className={
                                        "h-9 rounded-sm text-[10px] font-medium transition-colors " +
                                        (field.value === p.v
                                          ? "bg-primary text-white"
                                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400")
                                      }
                                    >
                                      <CircleDot className="h-3 w-3 mx-auto" />
                                      <div className="leading-none mt-0.5">
                                        {p.label.split(" ").slice(-1)[0]}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={mCtl}
                          name="watermarkOpacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex justify-between">
                                Opacity <span className="font-normal text-slate-500">{field.value}%</span>
                              </FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={field.value}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                    className="flex-1 accent-primary"
                                  />
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="w-20"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <SectionActions
                    section="media"
                    loading={saving || mediaLoading}
                    onSave={() => saveSection("media")}
                  />
                </Form>
              </FormProvider>
            </TabsContent>

            <TabsContent value="legal">
              <FormProvider {...legalMethods}>
                <Form
                  onSubmit={legalMethods.handleSubmit(() => saveSection("legal"))}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <LegalTextarea
                      label="Refund Policy"
                      name="refundPolicy"
                      control={lCtl}
                      count={refundLen}
                      placeholder="Our refund & return policy..."
                    />
                    <LegalTextarea
                      label="Privacy Policy"
                      name="privacyPolicy"
                      control={lCtl}
                      count={privacyLen}
                      placeholder="How we collect, store, and use data..."
                    />
                    <LegalTextarea
                      label="Terms of Service"
                      name="termsOfService"
                      control={lCtl}
                      count={tosLen}
                      placeholder="Terms governing purchases from your store..."
                    />
                    <LegalTextarea
                      label="Shipping Policy"
                      name="shippingPolicy"
                      control={lCtl}
                      count={shipLen}
                      placeholder="Shipping rates, zones, and delivery times..."
                    />
                  </div>

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-start gap-2">
                      <Controller
                        control={lCtl}
                        name="cookieNoticeEnabled"
                        render={({ field }) => (
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(v)}
                          />
                        )}
                      />
                      <div>
                        <Label className="font-medium">Cookie Notice Banner</Label>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Shows a consent banner at the bottom of the storefront.
                        </p>
                      </div>
                    </div>
                    {lWatch("cookieNoticeEnabled") && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-4 pl-6">
                        <FormField
                          control={lCtl}
                          name="cookieNoticeMessage"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="flex justify-between">
                                Notice Message{" "}
                                <span className="text-slate-500 font-normal text-xs">
                                  {cookieMsgLen}/500
                                </span>
                              </FormLabel>
                              <FormControl>
                                <Textarea rows={3} maxLength={500} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={lCtl}
                          name="cookieNoticeButtonText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Button Text</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Accept" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <SectionActions
                    section="legal"
                    loading={saving || legalLoading}
                    onSave={() => saveSection("legal")}
                  />
                </Form>
              </FormProvider>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SectionActions({
  section,
  loading,
  onSave,
}: {
  section: string;
  loading: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={onSave}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save {section.charAt(0).toUpperCase() + section.slice(1)}
      </Button>
    </div>
  );
}

function SizeField({
  label,
  wName,
  hName,
  control,
}: {
  label: string;
  wName: string;
  hName: string;
  control: any;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <FormField
          control={control}
          name={wName}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-[11px]">W (px)</FormLabel>
              <FormControl>
                <Input type="number" min={16} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <span className="text-slate-400 pt-6">×</span>
        <FormField
          control={control}
          name={hName}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-[11px]">H (px)</FormLabel>
              <FormControl>
                <Input type="number" min={16} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function LegalTextarea({
  label,
  name,
  control,
  count,
  placeholder,
}: {
  label: string;
  name: string;
  control: any;
  count: number;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex justify-between">
            {label}{" "}
            <span className="text-slate-500 font-normal text-xs">{count} words</span>
          </FormLabel>
          <FormControl>
            <Textarea rows={7} placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
