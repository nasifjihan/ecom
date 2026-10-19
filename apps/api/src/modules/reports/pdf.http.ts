import type { Request, Response } from "express"

/** Sends a report PDF: shown in the browser, or saved as a file with ?download=1. */
export function sendPdf(req: Request, res: Response, file: { filename: string; pdf: Buffer }): void {
  const download = req.query.download === "1" || req.query.download === "true"
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Length", String(file.pdf.length))
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${file.filename}"`)
  res.setHeader("Cache-Control", "private, no-store")
  res.status(200).end(file.pdf)
}
