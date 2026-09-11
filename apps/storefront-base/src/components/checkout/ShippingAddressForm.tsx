"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Home, Building2, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectItem,
  Checkbox,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  cn,
} from "@ecom/storefront-base";

export const BANGLADESH_DIVISIONS = [
  "Dhaka",
  "Chattogram",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
];

export const COUNTRIES = [
  { code: "BD", name: "Bangladesh" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
];

export const DHAKA_DCC = [
  "Dhaka North (DCC-N)",
  "Dhaka South (DCC-S)",
  "Gazipur City",
  "Narayanganj City",
  "Savar",
  "Keraniganj",
  "Tongi",
  "Uttara",
  "Banani",
  "Gulshan",
  "Dhanmondi",
  "Mirpur",
  "Mohammadpur",
  "Lalbagh",
  "Kotwali",
];

export const addressSchema = z.object({
  firstName: z.string().min(2, "First name is required").max(50),
  lastName: z.string().min(2, "Last name is required").max(50),
  company: z.string().max(100).optional().or(z.literal("")),
  country: z.string().min(2, "Country is required"),
  division: z.string().min(2, "Division/State is required").max(100),
  district: z.string().min(2, "District/City is required").max(100),
  postcode: z.string().min(3, "Postcode is required").max(20),
  addressLine1: z.string().min(5, "Address line 1 is required").max(255),
  addressLine2: z.string().max(255).optional().or(z.literal("")),
  phone: z
    .string()
    .regex(
      /^(\+8801|8801|01)[0-9]{9}$/,
      "Valid BD phone required: +8801XXXXXXXXX or 01XXXXXXXXX",
    ),
  email: z.string().email("Valid email is required").max(254),
});

export type AddressFormData = z.infer<typeof addressSchema>;

export type ShippingAddressFormProps = {
  defaultValues?: Partial<AddressFormData>;
  onSubmit?: (data: AddressFormData) => void;
  showEmailField?: boolean;
  billingSameAsShipping?: boolean;
  onBillingSameToggle?: (same: boolean) => void;
  billingAddress?: AddressFormData;
  onBillingSubmit?: (data: AddressFormData) => void;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
};

export function ShippingAddressForm({
  defaultValues,
  onSubmit,
  showEmailField = true,
  billingSameAsShipping = true,
  onBillingSameToggle,
  billingAddress,
  onBillingSubmit,
  title = "Shipping Address",
  icon,
  className,
}: ShippingAddressFormProps) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      country: "BD",
      division: "Dhaka",
      district: "",
      postcode: "",
      addressLine1: "",
      addressLine2: "",
      phone: "",
      email: "",
      ...defaultValues,
    },
    mode: "onBlur",
  });

  const country = watch("country");
  const isBD = country === "BD";

  const {
    control: billingControl,
    handleSubmit: handleBillingSubmit,
    formState: { errors: billingErrors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      country: "BD",
      division: "Dhaka",
      district: "",
      postcode: "",
      addressLine1: "",
      addressLine2: "",
      phone: "",
      email: "",
      ...billingAddress,
    },
    mode: "onBlur",
  });

  const handleFormSubmit = (data: AddressFormData) => {
    onSubmit?.(data);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            {icon ?? <Home className="h-5 w-5 text-primary" />}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
                        {...field}
                        className={cn(errors.firstName && "border-destructive")}
                      />
                    </FormControl>
                    {errors.firstName && (
                      <FormMessage>{errors.firstName.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Doe"
                        {...field}
                        className={cn(errors.lastName && "border-destructive")}
                      />
                    </FormControl>
                    {errors.lastName && (
                      <FormMessage>{errors.lastName.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <Controller
              name="company"
              control={control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Company (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Ltd." {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country *</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        className={cn(errors.country && "border-destructive")}
                      >
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </Select>
                    </FormControl>
                    {errors.country && (
                      <FormMessage>{errors.country.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
              <Controller
                name="division"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Division / State *</FormLabel>
                    <FormControl>
                      {isBD ? (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          className={cn(errors.division && "border-destructive")}
                        >
                          {BANGLADESH_DIVISIONS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          placeholder="State / Province"
                          {...field}
                          className={cn(errors.division && "border-destructive")}
                        />
                      )}
                    </FormControl>
                    {errors.division && (
                      <FormMessage>{errors.division.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                name="district"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District / City *</FormLabel>
                    <FormControl>
                      {isBD ? (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          className={cn(errors.district && "border-destructive")}
                        >
                          <SelectItem value="">Select city...</SelectItem>
                          {DHAKA_DCC.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                          <SelectItem value="Other">Other (type below)</SelectItem>
                        </Select>
                      ) : (
                        <Input
                          placeholder="City"
                          {...field}
                          className={cn(errors.district && "border-destructive")}
                        />
                      )}
                    </FormControl>
                    {errors.district && (
                      <FormMessage>{errors.district.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
              <Controller
                name="postcode"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode / ZIP *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={isBD ? "1205" : "Postcode"}
                        {...field}
                        className={cn(errors.postcode && "border-destructive")}
                      />
                    </FormControl>
                    {errors.postcode && (
                      <FormMessage>{errors.postcode.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <Controller
              name="addressLine1"
              control={control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="House #42, Road #11, Banani"
                      {...field}
                      className={cn(errors.addressLine1 && "border-destructive")}
                    />
                  </FormControl>
                  {errors.addressLine1 && (
                    <FormMessage>{errors.addressLine1.message}</FormMessage>
                  )}
                </FormItem>
              )}
            />

            <Controller
              name="addressLine2"
              control={control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2 (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Apartment, suite, unit, floor, etc."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={isBD ? "+8801XXXXXXXXX" : "+1 555 0123 4567"}
                        {...field}
                        className={cn(errors.phone && "border-destructive")}
                      />
                    </FormControl>
                    {errors.phone && (
                      <FormMessage>{errors.phone.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
              {showEmailField && (
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          className={cn(errors.email && "border-destructive")}
                        />
                      </FormControl>
                      {errors.email && (
                        <FormMessage>{errors.email.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              )}
            </div>
          </Form>
        </CardContent>
      </Card>

      {onBillingSameToggle && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3 mb-4">
              <Checkbox
                checked={billingSameAsShipping}
                onCheckedChange={onBillingSameToggle}
              />
              <div>
                <Label className="font-semibold cursor-pointer">
                  Billing address same as shipping
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uncheck if your billing address is different from your shipping address
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!billingSameAsShipping && onBillingSubmit && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Billing Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form
              onSubmit={handleBillingSubmit((data) => onBillingSubmit?.(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="firstName"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          {...field}
                          className={cn(billingErrors.firstName && "border-destructive")}
                        />
                      </FormControl>
                      {billingErrors.firstName && (
                        <FormMessage>{billingErrors.firstName.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
                <Controller
                  name="lastName"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          {...field}
                          className={cn(billingErrors.lastName && "border-destructive")}
                        />
                      </FormControl>
                      {billingErrors.lastName && (
                        <FormMessage>{billingErrors.lastName.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              </div>

              <Controller
                name="company"
                control={billingControl}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Ltd." {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="country"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country *</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          className={cn(billingErrors.country && "border-destructive")}
                        >
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </Select>
                      </FormControl>
                      {billingErrors.country && (
                        <FormMessage>{billingErrors.country.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
                <Controller
                  name="division"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Division / State *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="State"
                          {...field}
                          className={cn(billingErrors.division && "border-destructive")}
                        />
                      </FormControl>
                      {billingErrors.division && (
                        <FormMessage>{billingErrors.division.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="district"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District / City *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="City"
                          {...field}
                          className={cn(billingErrors.district && "border-destructive")}
                        />
                      </FormControl>
                      {billingErrors.district && (
                        <FormMessage>{billingErrors.district.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
                <Controller
                  name="postcode"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="1205"
                          {...field}
                          className={cn(billingErrors.postcode && "border-destructive")}
                        />
                      </FormControl>
                      {billingErrors.postcode && (
                        <FormMessage>{billingErrors.postcode.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              </div>

              <Controller
                name="addressLine1"
                control={billingControl}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="House #42, Road #11"
                        {...field}
                        className={cn(billingErrors.addressLine1 && "border-destructive")}
                      />
                    </FormControl>
                    {billingErrors.addressLine1 && (
                      <FormMessage>{billingErrors.addressLine1.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />

              <Controller
                name="addressLine2"
                control={billingControl}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Floor, Suite, etc." {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="phone"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+8801XXXXXXXXX"
                          {...field}
                          className={cn(billingErrors.phone && "border-destructive")}
                        />
                      </FormControl>
                      {billingErrors.phone && (
                        <FormMessage>{billingErrors.phone.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
                <Controller
                  name="email"
                  control={billingControl}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          className={cn(billingErrors.email && "border-destructive")}
                        />
                      </FormControl>
                      {billingErrors.email && (
                        <FormMessage>{billingErrors.email.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ShippingAddressForm;
