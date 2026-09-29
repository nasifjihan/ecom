/**
 * REDIRECT RULES — pure rules for the shop's URL redirects.
 *
 * "From" is a path on the shop, kept in one form so lookups are exact: lowercase, no query or
 * #part, no trailing slash ("/Summer-Sale/?x=1" → "/summer-sale"). "To" is a path on the shop
 * (query allowed) or a full http(s) address. A redirect whose target is itself redirected is
 * followed to the end (so visitors get one hop), and loops are refused.
 */

export type RedirectCode = 301 | 302

/** Paths the shop needs for itself; they can't be redirected. */
const RESERVED = [/^\/$/, /^\/_next(\/|$)/, /^\/api(\/|$)/]

/** The stored form of a "from" address, or null when it isn't a usable path. */
export function normalizePath(raw: string): string | null {
  let s = raw.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname
    } catch {
      return null
    }
  }
  s = s.split(/[?#]/)[0]!
  try {
    s = decodeURI(s)
  } catch {
    // keep as typed
  }
  if (!s.startsWith("/")) s = `/${s}`
  s = s.replace(/\/{2,}/g, "/").toLowerCase()
  if (s.length > 1) s = s.replace(/\/+$/, "")
  if (/\s/.test(s) || s.length > 500) return null
  return s
}

export function isReserved(path: string): boolean {
  return RESERVED.some((r) => r.test(path))
}

/** The stored form of a "to" address: a shop path (query kept) or a full http(s) URL. */
export function normalizeTarget(raw: string): string | null {
  const s = raw.trim()
  if (!s || s.length > 1000 || /\s/.test(s)) return null
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).toString()
    } catch {
      return null
    }
  }
  if (s.startsWith("//")) return null
  const withSlash = s.startsWith("/") ? s : `/${s}`
  const [path, rest] = splitQuery(withSlash)
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path
  return p + rest
}

function splitQuery(s: string): [string, string] {
  const i = s.search(/[?#]/)
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i)]
}

/** The "from" form of a target, when it points at this shop (null for other websites). */
export function targetPath(to: string): string | null {
  return to.startsWith("/") ? normalizePath(to) : null
}

export interface RedirectRule {
  fromPath: string
  toUrl: string
  statusCode: number
}

/**
 * Follows each redirect to its final address (up to 10 hops). The result is permanent only when
 * every hop is. Redirects caught in a loop are left out.
 */
export function resolveChains(list: readonly RedirectRule[]): RedirectRule[] {
  const byFrom = new Map(list.map((r) => [r.fromPath, r]))
  const out: RedirectRule[] = []
  for (const r of list) {
    let to = r.toUrl
    let code = r.statusCode
    const seen = new Set([r.fromPath])
    let loop = false
    for (let i = 0; i < 10; i++) {
      const next = targetPath(to)
      const hop = next ? byFrom.get(next) : undefined
      if (!hop) break
      if (seen.has(hop.fromPath)) {
        loop = true
        break
      }
      seen.add(hop.fromPath)
      to = hop.toUrl
      if (hop.statusCode !== 301) code = 302
    }
    if (!loop) out.push({ fromPath: r.fromPath, toUrl: to, statusCode: code })
  }
  return out
}

/** Would adding / changing `r` make visitors go round in a circle? */
export function makesLoop(list: readonly RedirectRule[], r: RedirectRule): boolean {
  const others = list.filter((x) => x.fromPath !== r.fromPath)
  if (targetPath(r.toUrl) === r.fromPath) return true
  return resolveChains([...others, r]).every((x) => x.fromPath !== r.fromPath)
}

export interface ImportRow {
  line: number
  fromPath: string
  toUrl: string
  statusCode: RedirectCode
}

/**
 * Reads pasted lines "old, new" or "old, new, 302" (commas or tabs). Blank lines, "#" comments
 * and a header line are skipped; bad lines come back as errors.
 */
export function parseImport(text: string): { rows: ImportRow[]; errors: { line: number; message: string }[] } {
  const rows: ImportRow[] = []
  const errors: { line: number; message: string }[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    const t = raw.trim()
    if (!t || t.startsWith("#")) return
    const parts = t.split(/\t|,/).map((p) => p.trim())
    if (line === 1 && /^(from|old)/i.test(parts[0] ?? "")) return
    const [from, to, code] = parts
    const fromPath = normalizePath(from ?? "")
    const toUrl = normalizeTarget(to ?? "")
    const problem = !fromPath
      ? "The old address isn't a path"
      : isReserved(fromPath)
        ? `${fromPath} can't be redirected`
        : !toUrl
          ? "The new address is missing or not valid"
          : code && code !== "301" && code !== "302"
            ? "Use 301 or 302"
            : null
    if (problem || !fromPath || !toUrl) errors.push({ line, message: problem ?? "Not a redirect" })
    else rows.push({ line, fromPath, toUrl, statusCode: code === "302" ? 302 : 301 })
  })
  return { rows, errors }
}
