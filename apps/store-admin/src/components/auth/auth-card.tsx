"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui";

/** Centred card for the signed-out pages (forgot and reset password), matching the login page. */
export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <Card className="w-full max-w-md rounded-2xl p-8 shadow-xl sm:p-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        <div className="mt-6">{children}</div>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </Card>
    </div>
  );
}

/** Reads the API's message out of an RTK Query error. */
export function apiError(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string; errors?: Record<string, string[]> } | string };
  if (typeof e?.data === "string") return e.data;
  const field = e?.data?.errors && Object.values(e.data.errors)[0]?.[0];
  return field || e?.data?.message || fallback;
}
