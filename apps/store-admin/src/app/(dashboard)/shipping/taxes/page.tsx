"use client";

import { motion } from "framer-motion";
import { Receipt } from "lucide-react";

export default function TaxesPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center"
    >
      <div className="h-20 w-20 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mb-6">
        <Receipt className="h-10 w-10 text-rose-600 dark:text-rose-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Taxes
      </h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-md">
        Taxes coming soon.
      </p>
    </motion.div>
  );
}
