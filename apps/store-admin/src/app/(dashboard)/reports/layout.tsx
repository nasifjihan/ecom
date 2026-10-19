"use client";

/** Reports: a title, the report tabs and the date range shared by every report page. */
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, FileDown } from "lucide-react";
import { openFile } from "@ecom/api-client";
import { Button } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { RangeBar, ReportLoading, ReportTabs, useReportRange } from "@/components/reports/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useReportPdfMutation } from "@/lib/features/reports/reports-api-slice";

/** The report each page shows, for its PDF. */
const PDF_KEY: Record<string, string> = {
  "/reports": "sales",
  "/reports/products": "products",
  "/reports/discounts": "discounts",
  "/reports/customers": "customers",
  "/reports/couriers": "couriers",
  "/reports/returns": "returns",
  "/reports/tax": "tax",
  "/reports/stock": "stock",
};

function PdfButton({ report }: { report: string }) {
  const { args, from, to } = useReportRange();
  const [load, { isLoading }] = useReportPdfMutation();
  const onClick = async () => {
    try {
      const params = report === "stock" ? {} : args;
      await openFile(() => load({ report, ...params }).unwrap(), { filename: `${report}-${from}-to-${to}.pdf`, mode: "download" });
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick} disabled={isLoading}>
      <FileDown className="h-4 w-4" /> {isLoading ? "Making PDF…" : "Download PDF"}
    </Button>
  );
}

function Header() {
  const pathname = usePathname();
  const schedules = pathname.startsWith("/reports/schedules");
  const stock = pathname === "/reports/stock";
  const noBasis = stock || pathname === "/reports/couriers" || pathname === "/reports/returns";
  const pdf = PDF_KEY[pathname];
  return (
    <>
      <PageTitle
        icon={BarChart3}
        title="Reports"
        description={
          schedules
            ? "Reports emailed as a PDF on a schedule, to your team and anyone else you add."
            : "Figures for the dates you choose, in the shop's time zone. Cancelled and failed orders are never counted."
        }
        actions={pdf ? <PdfButton report={pdf} /> : undefined}
      />
      <ReportTabs />
      {!stock && !schedules && <RangeBar showBasis={!noBasis} />}
    </>
  );
}

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <Suspense fallback={<ReportLoading />}>
        <Header />
        {children}
      </Suspense>
    </div>
  );
}
