"use client";

/**
 * Product import: pick a CSV or Excel sheet, check it (nothing is saved), then import.
 * Products are matched by product_sku: new SKUs are created, known ones updated (only filled cells change).
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Download, FileSpreadsheet, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { openFile } from "@ecom/api-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import {
  useImportProductsMutation,
  usePreviewProductImportMutation,
  useProductImportTemplateMutation,
  type ImportPreview,
  type ImportResult,
} from "@/lib/features/catalog/catalog-api-slice";
import { errorText } from "@/lib/features/content/content-api-slice";

const MAX_BYTES = 5 * 1024 * 1024;

const rowsLabel = (rows: number[]) => (rows.length === 1 ? `Row ${rows[0]}` : `Rows ${rows[0]}–${rows[rows.length - 1]}`);

export default function ProductImportPage() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [check, { isLoading: checking }] = usePreviewProductImportMutation();
  const [runImport, { isLoading: importing }] = useImportProductsMutation();
  const [loadTemplate] = useProductImportTemplateMutation();

  const form = (f: File) => {
    const body = new FormData();
    body.append("file", f);
    return body;
  };

  const choose = async (f: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!f) return;
    setPreview(null);
    setResult(null);
    if (!/\.(csv|xlsx|txt)$/i.test(f.name)) return void toast.error("Choose a .csv or .xlsx file");
    if (f.size > MAX_BYTES) return void toast.error("Import files must be 5 MB or smaller");
    setFile(f);
    try {
      setPreview(await check(form(f)).unwrap());
    } catch (err) {
      toast.error(errorText(err, "This file can't be checked"));
    }
  };

  const doImport = async () => {
    if (!file) return;
    try {
      const res = await runImport(form(file)).unwrap();
      setResult(res);
      setPreview(null);
      toast.success(`${res.created} created, ${res.updated} updated`);
    } catch (err) {
      toast.error(errorText(err, "Import failed"));
    }
  };

  const template = (format: "csv" | "xlsx") =>
    openFile(() => loadTemplate(format).unwrap(), { filename: `product_import_template.${format}`, mode: "download" }).catch((err: unknown) =>
      toast.error(errorText(err, "Couldn't download the template")),
    );

  const ready = preview ? preview.summary.create + preview.summary.update : 0;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/catalog/products" aria-label="Back to products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import products</h1>
          <p className="text-sm text-muted-foreground">Add or update many products at once from a CSV or Excel sheet.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Get the sheet ready</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              The first row holds the column names. Only <b>product_sku</b> is required; a new product also needs a <b>name</b> and a <b>price</b>.
            </li>
            <li>A product_sku already in your catalog updates that product. Empty cells leave its current values alone.</li>
            <li>
              For sizes or colours, add one row per variant with the same product_sku, a <b>variant_sku</b> and <b>option1_name</b> /{" "}
              <b>option1_value</b> (up to 3 options).
            </li>
            <li>
              Categories are written as a path, e.g. <i>Men &gt; Panjabi</i>, and must already exist. Several image links or tags are separated by{" "}
              <b>|</b> or commas.
            </li>
            <li>Prices can include ৳, commas or Bangla digits. Up to 2,000 rows and 5 MB per file.</li>
            <li>An export from the Products page uses the same columns, so you can edit it and import it back.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void template("csv")}>
              <Download className="h-4 w-4" /> Template (CSV)
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void template("xlsx")}>
              <Download className="h-4 w-4" /> Template (Excel)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Check the file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button className="gap-2" onClick={() => input.current?.click()} disabled={checking || importing}>
              <FileSpreadsheet className="h-4 w-4" /> {file ? "Choose another file" : "Choose file"}
            </Button>
            {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
            {checking && <span className="text-sm text-muted-foreground">Checking…</span>}
          </div>
          <p className="text-xs text-muted-foreground">Checking doesn&apos;t change anything. You&apos;ll see what will happen to each product first.</p>

          {preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{preview.summary.rows} rows</Badge>
                <Badge variant="success">{preview.summary.create} new</Badge>
                <Badge variant="outline">{preview.summary.update} to update</Badge>
                {preview.summary.variants > 0 && <Badge variant="outline">{preview.summary.variants} variants</Badge>}
                {preview.summary.withErrors > 0 && <Badge variant="destructive">{preview.summary.withErrors} with problems (skipped)</Badge>}
              </div>
              {preview.fileErrors.map((e) => (
                <p key={e} className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {e}
                </p>
              ))}
              {preview.unknownColumns.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  These columns aren&apos;t used and will be ignored: {preview.unknownColumns.join(", ")}
                </p>
              )}
              <div className="max-h-[480px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Rows</TableHead>
                      <TableHead>Product SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-24">Variants</TableHead>
                      <TableHead className="w-28">Action</TableHead>
                      <TableHead>Problems</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.products.map((p) => (
                      <TableRow key={`${p.sku}-${p.rows[0]}`}>
                        <TableCell className="text-muted-foreground">{rowsLabel(p.rows)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell>{p.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{p.variants || "—"}</TableCell>
                        <TableCell>
                          {p.errors.length ? (
                            <Badge variant="destructive">Skip</Badge>
                          ) : p.action === "create" ? (
                            <Badge variant="success">Create</Badge>
                          ) : (
                            <Badge variant="outline">Update</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-red-600 dark:text-red-400">
                          {p.errors.map((e) => (
                            <div key={`${e.row}-${e.message}`}>
                              Row {e.row}: {e.message}
                            </div>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-2" onClick={() => void doImport()} disabled={importing || ready === 0}>
                  <Upload className="h-4 w-4" /> {importing ? "Importing…" : `Import ${ready} product${ready === 1 ? "" : "s"}`}
                </Button>
                {preview.summary.withErrors > 0 && (
                  <span className="text-sm text-muted-foreground">Products with problems are skipped. Fix them in the sheet and import it again.</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Import finished
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {result.created} created, {result.updated} updated
              {result.failed.length > 0 && `, ${result.failed.length} skipped`}.
            </p>
            {result.failed.length > 0 && (
              <ul className="space-y-1 text-red-600 dark:text-red-400">
                {result.failed.map((f) => (
                  <li key={f.sku}>
                    <span className="font-mono text-xs">{f.sku}</span> ({rowsLabel(f.rows)}): {f.message}
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" asChild>
              <Link href="/catalog/products">Go to products</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
