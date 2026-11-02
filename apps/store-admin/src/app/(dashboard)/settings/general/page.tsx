"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Save,
  Loader2,
  Store,
  MapPin,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Select,
  SelectItem,
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

type GeneralForm = z.infer<typeof generalSchema>;
type AddressForm = z.infer<typeof addressSchema>;

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

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState<string>("general");

  const { data: generalData, isLoading: generalLoading } = useGetSettingsQuery("general");
  const { data: addressData, isLoading: addressLoading } = useGetSettingsQuery("address");

  const [updateSettings, { isLoading: updateLoading }] = useUpdateSettingsMutation();

  const generalMethods = useForm<z.input<typeof generalSchema>, unknown, GeneralForm>({
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
  const addressMethods = useForm<z.input<typeof addressSchema>, unknown, AddressForm>({
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
  const { reset: resetGeneral, control: gCtl, watch: gWatch } = generalMethods;
  const { reset: resetAddress, control: aCtl } = addressMethods;

  const descLen = gWatch("storeDescription")?.length ?? 0;

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
  }, [generalData, addressData, resetGeneral, resetAddress]);

  const saveSection = async (section: "general" | "address") => {
    try {
      // handleSubmit(fn)() resolves to void, so validate with trigger() and read the values directly.
      const methods = section === "general" ? generalMethods : addressMethods;
      if (!(await (methods as any).trigger())) {
        toast.error("Please fix the highlighted fields.");
        return;
      }
      const values = (methods as any).getValues();
      await updateSettings({ section, values }).unwrap();
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved.`);
    } catch (e: any) {
      toast.error(e?.data?.message || (typeof e?.data === "string" ? e.data : `Failed to save ${section} settings.`));
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
            Configure identity, currency, units and defaults that apply across your storefront.
          </CardDescription>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
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
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                          <FormLabel>Registered business name</FormLabel>
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
                          <FormLabel>VAT registration number (BIN)</FormLabel>
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
                          <FormLabel>Trade licence number</FormLabel>
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
