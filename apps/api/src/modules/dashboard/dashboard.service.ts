import { BaseService, type RequestContext } from "../../core";
import { SuperDashboardRepo, StoreDashboardRepo } from "./dashboard.repository";
import type { DashboardRangeQueryDto, StoreDashboardExportDto } from "./dashboard.dto";

function formatDateForFilename(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function contentDispositionForExport(format: string, basename: string): string {
  const ext = format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv";
  const filename = `${basename}_${formatDateForFilename(new Date())}.${ext}`;
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export class DashboardService extends BaseService {
  private superRepo: SuperDashboardRepo;
  private storeRepo: StoreDashboardRepo;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.superRepo = new SuperDashboardRepo(ctx);
    this.storeRepo = new StoreDashboardRepo(ctx);
  }

  async getSuperStats(range?: DashboardRangeQueryDto): Promise<unknown> {
    const r = range ? { from: range.from, to: range.to } : {};
    return this.superRepo.getSuperStats(r);
  }

  async getStoreStats(range?: DashboardRangeQueryDto): Promise<unknown> {
    const r = range ? { from: range.from, to: range.to } : {};
    return this.storeRepo.getStoreStats(r);
  }

  async getStoreOverview(days: number) {
    return this.storeRepo.getStoreOverview(days);
  }

  async exportStoreDashboard(
    dto: StoreDashboardExportDto,
  ): Promise<{ buffer: Uint8Array; contentType: string; contentDisposition: string }> {
    const { format } = dto;
    const basename = "store_dashboard";
    const contentDisposition = contentDispositionForExport(format, basename);
    let contentType = "text/csv; charset=utf-8";
    if (format === "xlsx") {
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (format === "pdf") {
      contentType = "application/pdf";
    }
    const stub = new TextEncoder().encode(`${format} export stub — implement with csv-writer / exceljs / pdfkit`);
    return {
      buffer: stub,
      contentType,
      contentDisposition,
    };
  }
}
