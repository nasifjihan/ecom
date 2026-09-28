"use client";

/** Reports: a title, the report tabs and the date range shared by every report page. */
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PageTitle } from "@/components/content/shared";
import { RangeBar, ReportLoading, ReportTabs } from "@/components/reports/shared";

function Header() {
  const pathname = usePathname();
  const stock = pathname === "/reports/stock";
  const noBasis = stock || pathname === "/reports/couriers" || pathname === "/reports/returns";
  return (
    <>
      <PageTitle
        icon={BarChart3}
        title="Reports"
        description="Figures for the dates you choose, in the shop's time zone. Cancelled and failed orders are never counted."
      />
      <ReportTabs />
      {!stock && <RangeBar showBasis={!noBasis} />}
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
