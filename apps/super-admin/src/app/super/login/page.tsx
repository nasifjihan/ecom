"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  LogIn,
  ShieldCheck,
  Eye,
  EyeOff,
  Store,
  Building2,
  BarChart3,
  CreditCard,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui";
import { Button, Input, Card, Checkbox, Select, SelectItem } from "@/components/ui";
import { useLoginSuperMutation } from "@/lib/features/auth/auth-api-slice";
import { setSuperCredentials } from "@/lib/features/auth/auth-slice";
import { useDispatch } from "react-redux";

const superLoginSchema = z.object({
  email: z.string().email("Please enter a valid super admin email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional().default(false),
});

type SuperLoginFormValues = z.infer<typeof superLoginSchema>;

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [loginSuper, { isLoading }] = useLoginSuperMutation();

  const form = useForm<SuperLoginFormValues>({
    resolver: zodResolver(superLoginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  useEffect(() => {
    const tokenCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("superAccessToken="));
    if (tokenCookie) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onSubmit = async (values: SuperLoginFormValues) => {
    try {
      const result = await loginSuper({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      }).unwrap();

      dispatch(
        setSuperCredentials({
          user: result.user,
          accessToken: result.accessToken,
          permissions: result.permissions,
        }),
      );

      if (values.rememberMe) {
        const maxAge = 7 * 24 * 60 * 60;
        document.cookie = `superAccessToken=${result.accessToken}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
      } else {
        document.cookie = `superAccessToken=${result.accessToken}; path=/; SameSite=Lax; Secure`;
      }

      toast.success("Platform login successful", {
        description: `Welcome back, ${result.user.name}! Super admin mode active.`,
      });

      const redirect = searchParams.get("redirect") || "/dashboard";
      router.replace(redirect);
    } catch (err) {
      const error = err as {
        data?: string | Record<string, string[]>;
        status?: number;
      };
      let message = "Invalid super admin credentials. Please try again.";
      if (typeof error.data === "string") {
        message = error.data;
      } else if (error.data && typeof error.data === "object") {
        const firstKey = Object.keys(error.data)[0];
        if (firstKey && error.data[firstKey]?.[0]) {
          message = error.data[firstKey][0];
        }
      }
      toast.error("Platform login failed", { description: message });
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-rose-500/20 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-red-900/20 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.03 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(244,63,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.3) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-rose-950 via-rose-900 to-red-950 p-12 text-white rounded-l-3xl border-r border-rose-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 backdrop-blur border border-rose-500/30">
                  <ShieldCheck className="h-7 w-7 text-rose-400" />
                </div>
                <div>
                  <span className="text-xs font-bold tracking-[0.2em] text-rose-400/80 uppercase">
                    ECOM
                  </span>
                  <span className="block text-lg font-bold tracking-tight leading-tight">
                    PLATFORM SUPER
                  </span>
                </div>
              </div>

              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 mb-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                    <span className="text-xs font-semibold text-rose-300">
                      Restricted Access — Platform Level
                    </span>
                  </div>
                  <h2 className="text-4xl font-bold leading-tight">
                    Platform Super Admin Dashboard
                  </h2>
                  <p className="mt-4 text-lg text-rose-100/70">
                    Manage all tenant stores, billing, platform reports, and
                    RBAC administrators in one powerful control center.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="space-y-4"
                >
                  {[
                    { icon: Building2, text: "All tenant stores & domains management" },
                    { icon: CreditCard, text: "Billing plans, subscriptions & payouts" },
                    { icon: BarChart3, text: "Platform-wide analytics & audit logs" },
                    { icon: ShieldCheck, text: "RBAC admins & fine-grained permissions" },
                  ].map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/30">
                        <feature.icon className="h-3 w-3 text-rose-300" />
                      </div>
                      <span className="text-rose-100/80 text-sm">{feature.text}</span>
                    </div>
                  ))}
                </motion.div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-rose-300/60">
                  <Store className="h-3 w-3" />
                  <span>Multi-tenant SaaS E-commerce Platform</span>
                </div>
                <p className="text-xs text-rose-300/40">
                  © {new Date().getFullYear()} ECOM PLATFORM SUPER. All rights reserved.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-slate-900 p-8 sm:p-12 rounded-3xl lg:rounded-l-none lg:rounded-r-3xl shadow-2xl border border-slate-800"
            >
              <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30">
                  <ShieldCheck className="h-7 w-7 text-rose-400" />
                </div>
                <div>
                  <span className="text-xs font-bold tracking-[0.2em] text-rose-400/80 uppercase">
                    ECOM
                  </span>
                  <span className="block text-lg font-bold tracking-tight text-white leading-tight">
                    PLATFORM SUPER
                  </span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <h1 className="text-3xl font-bold text-white">
                  Sign in to Platform
                </h1>
                <p className="mt-2 text-slate-400">
                  Enter your super admin credentials for platform-wide access
                </p>
              </motion.div>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="mt-8 space-y-6"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-300">
                            Super Admin Email
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                              <Input
                                type="email"
                                placeholder="super.admin@ecom-platform.io"
                                className="h-11 pl-10 pr-4 border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                {...field}
                                disabled={isLoading}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                  >
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-300">
                        Domain / Store Scope
                      </FormLabel>
                      <Select disabled value="platform">
                        <SelectItem value="platform">
                          🌐 Entire Platform (All Stores)
                        </SelectItem>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1.5">
                        Super admins have access to all tenant stores by default
                      </p>
                    </FormItem>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-300">
                            Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter platform password"
                                className="h-11 pl-10 pr-12 border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                {...field}
                                disabled={isLoading}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                tabIndex={-1}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-5 w-5" />
                                ) : (
                                  <Eye className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="flex items-center justify-between"
                  >
                    <FormField
                      control={form.control}
                      name="rememberMe"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal text-slate-400 cursor-pointer">
                            Remember this device for 7 days
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <Link
                      href="/super/forgot-password"
                      className="text-sm font-medium text-rose-400 hover:text-rose-300"
                    >
                      Forgot password?
                    </Link>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                  >
                    <Button
                      type="submit"
                      className="h-11 w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-lg shadow-rose-900/30"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Authenticating...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <LogIn className="h-5 w-5" />
                          Sign in to Platform
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </form>
              </Form>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.5 }}
                className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
              >
                <p className="text-xs text-amber-400/90 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Security Notice:</strong> All super admin actions are
                    audit logged. IP address and device information are recorded
                    for every session.
                  </span>
                </p>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-6 text-center text-sm text-slate-500"
              >
                Not a platform super admin?{" "}
                <Link
                  href="/login"
                  className="font-medium text-rose-400 hover:text-rose-300"
                >
                  Go to Store Admin
                </Link>
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
