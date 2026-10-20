"use client"

/**
 * The admin's search (header box, or Ctrl+K / ⌘K): the pages this person may open, and orders,
 * customers and products from GET /admin/search. Arrow keys move, Enter opens, Escape closes.
 * Recent searches are remembered in this browser.
 */
import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Box, Clock, Package, Search, ShoppingCart, Star, User } from "lucide-react"
import { api } from "@ecom/api-client"
import { Dialog, DialogContent, cn } from "@/components/ui"
import { NAV_SECTIONS, SETTINGS_SECTIONS } from "@/lib/nav"
import { useCan } from "@/lib/permissions"
import { usePreferencesQuery } from "@/lib/features/settings/preferences-api-slice"

interface SearchResults {
  orders: {
    id: string
    number: string
    customer: string
    phone: string | null
    total: number
    status: string
  }[]
  customers: {
    id: string
    name: string
    phone: string | null
    email: string | null
    orders: number
  }[]
  products: { id: string; name: string; sku: string | null; status: string; stock: number | null }[]
}

const searchApi = api.injectEndpoints({
  endpoints: (b) => ({
    adminSearch: b.query<SearchResults, string>({
      query: (q) => ({ url: "/admin/search", params: { q } }),
      keepUnusedDataFor: 30,
    }),
  }),
})

interface Hit {
  key: string
  href: string
  title: string
  detail?: string
  icon: React.ComponentType<{ className?: string }>
  group: string
}

const RECENT_KEY = "adminSearchRecent"
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : []
  } catch {
    return []
  }
}
const saveRecent = (q: string) => {
  try {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 5)),
    )
  } catch {
    /* not remembered; search still works */
  }
}

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

export function CommandSearch() {
  const router = useRouter()
  const { can } = useCan()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [term, setTerm] = React.useState("")
  const [active, setActive] = React.useState(0)
  const [recent, setRecent] = React.useState<string[]>([])
  const listId = React.useId()
  const { data: prefs } = usePreferencesQuery()

  // Ctrl+K / ⌘K from anywhere in the admin.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  React.useEffect(() => {
    if (open) setRecent(readRecent())
    else {
      setQ("")
      setTerm("")
    }
  }, [open])
  React.useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching } = searchApi.useAdminSearchQuery(term, {
    skip: !open || term.length < 2,
  })

  const pages = React.useMemo(() => {
    const seen = new Set<string>()
    return [...NAV_SECTIONS, ...SETTINGS_SECTIONS].flatMap((s) =>
      s.items
        .filter((i) => can(i.perm) && !i.salesOnly && !seen.has(i.href) && seen.add(i.href))
        .map((i) => ({
          key: `page:${i.href}`,
          href: i.href,
          title: i.label,
          detail: s.title,
          icon: i.icon,
          group: "Pages",
        })),
    )
  }, [can])

  const hits: Hit[] = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    const marks: Hit[] = (prefs?.bookmarks ?? [])
      .filter((b) => !needle || b.label.toLowerCase().includes(needle))
      .map((b) => ({ key: `b:${b.href}`, href: b.href, title: b.label, detail: b.href, icon: Star, group: "Bookmarks" }))
    if (!needle) return marks
    const matchedPages = pages
      .filter(
        (p) => p.title.toLowerCase().includes(needle) || p.detail.toLowerCase().includes(needle),
      )
      .slice(0, 6)
    const records: Hit[] =
      term.length >= 2 && data
        ? [
            ...data.orders.map((o) => ({
              key: `o:${o.id}`,
              href: `/orders/${o.id}`,
              title: `Order ${o.number}`,
              detail: [
                o.customer,
                o.phone,
                taka(o.total),
                o.status.toLowerCase().replace(/_/g, " "),
              ]
                .filter(Boolean)
                .join(" · "),
              icon: ShoppingCart,
              group: "Orders",
            })),
            ...data.customers.map((c) => ({
              key: `c:${c.id}`,
              href: `/customers/${c.id}`,
              title: c.name !== "" ? c.name : (c.phone ?? "Customer"), // phone-only customers have no name
              detail: [c.phone, c.email, `${c.orders} orders`].filter(Boolean).join(" · "),
              icon: User,
              group: "Customers",
            })),
            ...data.products.map((p) => ({
              key: `p:${p.id}`,
              href: `/catalog/products/${p.id}`,
              title: p.name,
              detail: [p.sku, p.status, p.stock === null ? null : `${p.stock} in stock`]
                .filter(Boolean)
                .join(" · "),
              icon: Package,
              group: "Products",
            })),
          ]
        : []
    return [...marks, ...matchedPages, ...records]
  }, [q, term, data, pages, prefs])

  React.useEffect(() => setActive(0), [q, data])

  const go = (hit: Hit) => {
    if (q.trim()) saveRecent(q.trim())
    setOpen(false)
    router.push(hit.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(hits.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault()
      go(hits[active])
    }
  }

  const groups = [...new Set(hits.map((h) => h.group))]
  const noResults = q.trim().length >= 2 && !isFetching && term === q.trim() && hits.length === 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-full max-w-md flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-left text-sm text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        aria-label="Search the admin (Ctrl+K)"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <span className="flex-1 truncate">Search orders, customers, products, pages…</span>
        <kbd className="hidden rounded border bg-white px-1.5 text-[10px] font-medium text-slate-500 sm:inline dark:bg-slate-900">
          Ctrl K
        </kbd>
      </button>

      {/* Portalled to <body>: inside the header (z-20) it would sit under the sidebar (z-30). */}
      {open &&
        createPortal(
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
              className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
              aria-label="Search"
            >
              <div className="flex items-center gap-2 border-b px-4">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  role="combobox"
                  aria-expanded={hits.length > 0}
                  aria-controls={listId}
                  aria-activedescendant={hits[active] ? `${listId}-${hits[active].key}` : undefined}
                  aria-label="Search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Order number, phone, customer, product, SKU or page…"
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
                {isFetching && <span className="text-xs text-slate-400">Searching…</span>}
              </div>
              <div
                className="max-h-[60vh] overflow-y-auto p-2"
                id={listId}
                role="listbox"
                aria-label="Results"
              >
                {!q.trim() &&
                  (recent.length ? (
                    <div>
                      <p className="px-2 pb-1 pt-2 text-xs font-medium text-slate-500">
                        Recent searches
                      </p>
                      {recent.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setQ(r)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Clock className="h-4 w-4 text-slate-400" /> {r}
                        </button>
                      ))}
                    </div>
                  ) : hits.length ? null : (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">
                      Type an order number, a phone number, a name, a SKU or a page.
                    </p>
                  ))}
                {groups.map((g) => (
                  <div key={g} role="group" aria-label={g}>
                    <p className="px-2 pb-1 pt-2 text-xs font-medium text-slate-500">{g}</p>
                    {hits
                      .filter((h) => h.group === g)
                      .map((h) => {
                        const i = hits.indexOf(h)
                        return (
                          <div
                            key={h.key}
                            id={`${listId}-${h.key}`}
                            role="option"
                            aria-selected={i === active}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => go(h)}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2",
                              i === active && "bg-blue-50 dark:bg-blue-500/10",
                            )}
                          >
                            <h.icon className="h-4 w-4 shrink-0 text-slate-500" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{h.title}</span>
                              {h.detail && (
                                <span className="block truncate text-xs text-slate-500">
                                  {h.detail}
                                </span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                ))}
                {noResults && (
                  <p className="flex items-center justify-center gap-2 px-2 py-6 text-sm text-slate-500">
                    <Box className="h-4 w-4" /> Nothing found for “{q.trim()}”
                  </p>
                )}
              </div>
              <div className="flex gap-4 border-t px-4 py-2 text-[11px] text-slate-500">
                <span>↑ ↓ to move</span>
                <span>Enter to open</span>
                <span>Esc to close</span>
              </div>
            </DialogContent>
          </Dialog>,
          document.body,
        )}
    </>
  )
}
