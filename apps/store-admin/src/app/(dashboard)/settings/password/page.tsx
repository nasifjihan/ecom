"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

export default function PasswordSettingsPage() {
  useEffect(() => {
    window.location.replace("/settings/profile#password");
  }, []);
  redirect("/settings/profile#password");
}
