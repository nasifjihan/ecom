import { Router, type Request, type Response, type NextFunction } from "express"
import multer from "multer"
import { z } from "zod"
import {
  attachmentHeader,
  formatTimestampFilename,
  generateCsv,
  generateXlsx,
  type ExportColumn,
} from "@ecom/export-utils"
import { BadRequestError, ctrl, envelope, TooLargeError, type RequestContext } from "../../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../../middleware"
import { COLUMNS } from "./import.rules"
import {
  MAX_IMPORT_BYTES,
  ProductImportService,
  TEMPLATE_ROWS,
  type ImportFile,
} from "./import.service"

/**
 * Product import/export, mounted on the admin products router before its "/:id" routes.
 * The sheet's first row holds the column names, so exports use the raw names and re-import cleanly.
 */
export const productImportRouter = Router()

type Ctx = Request & { ctx: RequestContext }

const FormatQuery = z.object({ format: z.enum(["csv", "xlsx"]).default("csv") })
const ExportQuery = FormatQuery.extend({
  ids: z
    .string()
    .regex(/^\d+(,\d+)*$/)
    .transform((s) =>
      s
        .split(",")
        .slice(0, 1000)
        .map((x) => BigInt(x)),
    )
    .optional(),
})
const columns: ExportColumn<Partial<Record<string, string>>>[] = COLUMNS.map((c) => ({
  key: c,
  label: c,
  width: c.includes("description") || c === "image_urls" ? 40 : 16,
}))

const uploadSheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
}).single("file")

function parseSheetUpload(req: Request, res: Response, next: NextFunction): void {
  uploadSheet(
    req as unknown as Parameters<typeof uploadSheet>[0],
    res as unknown as Parameters<typeof uploadSheet>[1],
    (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
        return next(new TooLargeError("Import files must be 5 MB or smaller"))
      if (err) return next(err)
      next()
    },
  )
}

function fileOf(req: Request): ImportFile {
  const file = (req as Request & { file?: ImportFile }).file
  if (!file) throw new BadRequestError("Choose a .csv or .xlsx file to import", "VALIDATION_FAILED")
  return file
}

async function sendSheet(
  res: Response,
  base: string,
  format: "csv" | "xlsx",
  rows: Partial<Record<string, string>>[],
) {
  const buffer =
    format === "csv"
      ? generateCsv(rows, columns, { includeBom: true })
      : await generateXlsx([{ name: "Products", columns, rows }])
  const headers = attachmentHeader(formatTimestampFilename(base, format))
  res.setHeader("Content-Type", headers["Content-Type"])
  res.setHeader("Content-Disposition", headers["Content-Disposition"])
  res.status(200).send(buffer)
}

productImportRouter.get(
  "/export",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.view"),
  validate({ query: ExportQuery }),
  ctrl(async (req: Ctx, res: Response) => {
    const { format, ids } = req.query as unknown as z.infer<typeof ExportQuery>
    await sendSheet(
      res,
      "products",
      format,
      await new ProductImportService(req.ctx).exportRows(ids),
    )
  }),
)

productImportRouter.get(
  "/import/template",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.view"),
  validate({ query: FormatQuery }),
  ctrl(async (req: Ctx, res: Response) => {
    const { format } = req.query as unknown as z.infer<typeof FormatQuery>
    await sendSheet(res, "product_import_template", format, TEMPLATE_ROWS)
  }),
)

productImportRouter.post(
  "/import/preview",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.create"),
  parseSheetUpload,
  ctrl(async (req: Ctx, res: Response) => {
    const data = await new ProductImportService(req.ctx).preview(fileOf(req))
    envelope(res, { status: 200, data })
  }),
)

productImportRouter.post(
  "/import",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.create"),
  rbacMiddleware("products.edit"),
  parseSheetUpload,
  ctrl(async (req: Ctx, res: Response) => {
    const data = await new ProductImportService(req.ctx).run(fileOf(req))
    envelope(res, {
      status: 200,
      data,
      message: `${data.created} created, ${data.updated} updated, ${data.failed.length} skipped`,
    })
  }),
)
