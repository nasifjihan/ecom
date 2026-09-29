/**
 * PDF FONTS — one font for English and Bangla, shaped the way browsers do it.
 *
 * `assets/fonts/InvoiceSans-*.ttf` is Noto Sans merged with Noto Sans Bengali (built by
 * `scripts/build-invoice-font.py`), so a single font covers Latin text, Bangla and ৳.
 *
 * pdfkit lays text out with fontkit, which gets some Bangla conjuncts wrong ("চন্দ্র" loses its
 * ra-phala). `useFonts` swaps the font's layout for HarfBuzz, the shaper browsers use; pdfkit still
 * handles wrapping, alignment, subsetting and copy-paste text.
 */
import { readFile } from "node:fs/promises"

export const FONT = { regular: "InvoiceSans", bold: "InvoiceSans-Bold" } as const

const FILES = {
  [FONT.regular]: "InvoiceSans-Regular.ttf",
  [FONT.bold]: "InvoiceSans-Bold.ttf",
} as const

type HarfBuzz = typeof import("harfbuzzjs")

interface Loaded {
  hb: HarfBuzz
  files: Record<string, { bytes: Buffer; hbFont: InstanceType<HarfBuzz["Font"]> }>
}

const ZWNJ = 0x200c

let loading: Promise<Loaded> | null = null
/** Code points the fonts can draw, known once they're loaded. */
let covered: Set<number> | null = null

/** Reads the font files and starts HarfBuzz once per process. */
function load(): Promise<Loaded> {
  loading ??= (async () => {
    const hb = await import("harfbuzzjs")
    const files: Loaded["files"] = {}
    for (const [name, file] of Object.entries(FILES)) {
      const bytes = await readFile(new URL(`../../../assets/fonts/${file}`, import.meta.url))
      const hbFont = new hb.Font(new hb.Face(new hb.Blob(new Uint8Array(bytes))))
      files[name] = { bytes, hbFont }
    }
    return { hb, files }
  })().catch((e: unknown) => {
    loading = null
    throw e
  })
  return loading
}

/** The parts of a fontkit font and glyph that pdfkit's layout uses. */
interface FontkitGlyph {
  id: number
  advanceWidth: number
  codePoints: number[]
}
interface FontkitFont {
  characterSet: number[]
  getGlyph(id: number, codePoints?: number[]): FontkitGlyph
  glyphForCodePoint(cp: number): { id: number }
  layout: (text: string) => { glyphs: FontkitGlyph[]; positions: Position[]; advanceWidth: number }
}
interface Position {
  xAdvance: number
  yAdvance: number
  xOffset: number
  yOffset: number
}

/** Shapes `text` with HarfBuzz into the glyphs-and-positions shape fontkit returns. */
export function shapeRun(
  hb: HarfBuzz,
  hbFont: Loaded["files"][string]["hbFont"],
  font: FontkitFont,
  text: string,
) {
  const buf = new hb.Buffer()
  buf.addText(text)
  buf.guessSegmentProperties()
  hb.shape(hbFont, buf)
  const infos = buf.getGlyphInfos()
  const pos = buf.getGlyphPositions()
  // What each glyph copies as. pdfkit keeps one text per glyph id for the whole PDF, so a glyph
  // that stands for one letter copies as that letter; letters merged into a conjunct go on the
  // cluster's other glyphs (the conjunct itself).
  const starts = [...new Set(infos.map((i) => i.cluster))].sort((a, b) => a - b)
  const clusterChars = (c: number) => {
    const next = starts.find((s) => s > c) ?? text.length
    return [...text.slice(c, next)].map((ch) => ch.codePointAt(0) ?? 0)
  }
  const copyAs: number[][] = infos.map(() => [])
  for (const c of starts) {
    const members = infos.flatMap((info, i) => (info.cluster === c ? [i] : []))
    const left = clusterChars(c)
    const merged: number[] = []
    for (const i of members) {
      const k = left.findIndex((cp) => font.glyphForCodePoint(cp).id === infos[i]!.codepoint)
      if (k >= 0) copyAs[i] = left.splice(k, 1)
      else merged.push(i)
    }
    // Leftover letters go one each onto the merged glyphs, the last taking the rest; a glyph with
    // nothing copies as an invisible ZWNJ, since an empty entry makes viewers paste junk.
    const targets = merged.length ? merged : [members[members.length - 1]!]
    targets.forEach((i, n) => {
      const take = n === targets.length - 1 ? left.splice(0) : left.splice(0, 1)
      copyAs[i] = [...copyAs[i]!, ...take]
    })
    for (const i of members) if (!copyAs[i]!.length) copyAs[i] = [ZWNJ]
  }
  const glyphs: FontkitGlyph[] = []
  const positions: Position[] = []
  infos.forEach((info, i) => {
    // A fresh object: fontkit caches one glyph per id.
    glyphs.push({
      id: info.codepoint,
      advanceWidth: font.getGlyph(info.codepoint).advanceWidth,
      codePoints: copyAs[i]!,
    })
    const p = pos[i]!
    positions.push({
      xAdvance: p.xAdvance,
      yAdvance: p.yAdvance,
      xOffset: p.xOffset,
      yOffset: p.yOffset,
    })
  })
  return {
    glyphs,
    positions,
    // Read after pdfkit scales the positions, like fontkit's own getter.
    get advanceWidth() {
      return positions.reduce((w, p) => w + p.xAdvance, 0)
    },
  }
}

/**
 * Text ready for the PDF: odd spaces become plain spaces, control characters go, and characters
 * the font can't draw (emoji, other scripts) become "?". Bangla, ৳ and Latin text are kept.
 */
export function pdfText(s: string | null | undefined): string {
  return Array.from(s ?? "", (c) => {
    const code = c.codePointAt(0) ?? 0
    if (code === 9 || code === 10 || code === 13) return c
    if (code === 0x200c || code === 0x200d) return c // ZWNJ / ZWJ shape Bangla conjuncts
    if ((code >= 0x2000 && code <= 0x200b) || code === 0x202f) return " "
    if (code < 0x20 || (code >= 0x7f && code < 0xa0) || code === 0xfe0f) return ""
    if (covered) return covered.has(code) ? c : "?"
    return c
  }).join("")
}

/** Registers the invoice fonts on `doc` with HarfBuzz shaping. Call before drawing. */
export async function useFonts(doc: PDFKit.PDFDocument): Promise<void> {
  const { hb, files } = await load()
  for (const [name, f] of Object.entries(files)) {
    doc.registerFont(name, f.bytes)
    doc.font(name)
    // pdfkit keeps the fontkit font of the font just selected here.
    const font = (doc as unknown as { _font: { font: FontkitFont } })._font.font
    font.layout = (text: string) => shapeRun(hb, f.hbFont, font, text)
    covered ??= new Set(font.characterSet)
  }
}
