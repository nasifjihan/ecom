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
  ShoppingBag,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  FormProvider,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui";
import { Button, Input, Card, Checkbox } from "@/components/ui";
import { useLoginMutation } from "@/lib/features/auth/auth-api-slice";
import { setCredentials } from "@/lib/features/auth/auth-slice";
import { useDispatch } from "react-redux";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [login, { isLoading }] = useLoginMutation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  useEffect(() => {
    const tokenCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("accessToken="));
    if (tokenCookie) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const result = await login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      }).unwrap();

      dispatch(
        setCredentials({
          user: result.user,
          accessToken: result.accessToken,
          storeId: result.storeId ?? result.store?.id ?? null,
          permissions: result.permissions,
        }),
      );

      if (values.rememberMe) {
        const maxAge = 7 * 24 * 60 * 60;
        document.cookie = `accessToken=${result.accessToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
        if (result.storeId || result.store?.id) {
          const storeId = result.storeId ?? result.store?.id;
          document.cookie = `X-Store-Id=${storeId}; path=/; max-age=${maxAge}; SameSite=Lax`;
        }
      } else {
        document.cookie = `accessToken=${result.accessToken}; path=/; SameSite=Lax`;
        if (result.storeId || result.store?.id) {
          const storeId = result.storeId ?? result.store?.id;
          document.cookie = `X-Store-Id=${storeId}; path=/; SameSite=Lax`;
        }
      }

      toast.success("Login successful", {
        description: `Welcome back, ${result.user.name}!`,
      });

      const redirect = searchParams.get("redirect") || "/dashboard";
      router.replace(redirect);
    } catch (err) {
      const error = err as { data?: string | Record<string, string[]>; status?: number };
      let message = "Invalid email or password. Please try again.";
      if (typeof error.data === "string") {
        message = error.data;
      } else if (error.data && typeof error.data === "object") {
        const firstKey = Object.keys(error.data)[0];
        if (firstKey && error.data[firstKey]?.[0]) {
          message = error.data[firstKey][0];
        }
      }
      toast.error("Login failed", { description: message });
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/20"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-200/40 blur-3xl dark:bg-purple-500/20"
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-12 text-white rounded-l-3xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <ShoppingBag className="h-7 w-7" />
                </div>
                <span className="text-2xl font-bold tracking-tight">
                  Fashion BD
                </span>
              </div>

              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <h2 className="text-4xl font-bold leading-tight">
                    Welcome to the Admin Dashboard
                  </h2>
                  <p className="mt-4 text-lg text-white/80">
                    Manage your store, track orders, and grow your business with
                    powerful insights.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="space-y-4"
                >
                  {[
                    "Real-time sales analytics & reports",
                    "Complete catalog & inventory control",
                    "Order, customer & shipping management",
                  ].map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <span className="text-white/90">{feature}</span>
                    </div>
                  ))}
                </motion.div>
              </div>

              <p className="text-sm text-white/60">
                © {new Date().getFullYear()} Fashion BD. All rights reserved.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl lg:rounded-l-none lg:rounded-r-3xl shadow-2xl"
            >
              <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <ShoppingBag className="h-7 w-7" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Fashion BD
                </span>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  Sign in
                </h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  Enter your credentials to access your admin account
                </p>
              </motion.div>

              <FormProvider {...form}>
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
                          <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Email address
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                              <Input
                                type="email"
                                placeholder="admin@store.com"
                                className="h-11 pl-10 pr-4 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500"
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
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                className="h-11 pl-10 pr-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500"
                                {...field}
                                disabled={isLoading}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                          <FormLabel className="text-sm font-normal text-slate-600 dark:text-slate-400 cursor-pointer">
                            Remember me for 7 days
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
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
                      className="h-11 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
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
                          Signing in...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <LogIn className="h-5 w-5" />
                          Sign in
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </form>
              </FormProvider>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400"
              >
                Having trouble signing in?{" "}
                <Link
                  href="/help"
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Contact support
                </Link>
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
