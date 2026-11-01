/**
 * Shop search: a product matches when its name, SKU, short description, tag, brand or Bangla
 * name contains the words, or its name is spelt close enough (pg_trgm: "panjbi" finds "Panjabi").
 * Words the shop marked as the same (Online store > Search words) are tried too.
 */
import { z } from "zod"
import { prisma } from "../../config"

/** Shorter words would match too much by spelling alone. */
const FUZZY_MIN_LENGTH = 4
const MAX_VERSIONS = 12

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/**
 * The search and its same-meaning versions: the whole phrase swapped for its group's other words,
 * or one word at a time ("red punjabi" → "red panjabi").
 */
export function expandQuery(raw: string, groups: string[][]): string[] {
  const q = norm(raw)
  const out = new Set([q])
  const groupOf = (w: string) => groups.find((g) => g.includes(w))
  for (const alt of groupOf(q) ?? []) out.add(alt)
  const words = q.split(" ")
  if (words.length > 1)
    words.forEach((w, i) => {
      for (const alt of groupOf(w) ?? []) out.add([...words.slice(0, i), alt, ...words.slice(i + 1)].join(" "))
    })
  return [...out].slice(0, MAX_VERSIONS)
}

export async function synonymGroups(storeId: bigint): Promise<string[][]> {
  const rows = await prisma.searchSynonym.findMany({ where: { storeId }, select: { words: true } })
  return rows.map((r) => r.words.map(norm))
}

const likeOf = (t: string) => `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** Published products matching the search, with a score: 2 for a name containing it, else how close the spelling is. */
export async function searchMatches(storeId: bigint, raw: string): Promise<Map<bigint, number>> {
  const terms = expandQuery(raw, await synonymGroups(storeId)).filter(Boolean)
  if (!terms.length) return new Map()
  const rows = await prisma.$queryRaw<{ id: bigint; score: number }[]>`
    SELECT p.id, MAX(CASE WHEN p.name ILIKE q.l THEN 2 ELSE word_similarity(q.t, p.name) END)::float AS score
    FROM "Product" p
    LEFT JOIN "Brand" b ON b.id = p."brandId"
    CROSS JOIN unnest(${terms}::text[], ${terms.map(likeOf)}::text[]) AS q(t, l)
    WHERE p."storeId" = ${storeId} AND p.status = 'published' AND p."deletedAt" IS NULL
      AND (
        p.name ILIKE q.l OR p.sku ILIKE q.l OR p."shortDescription" ILIKE q.l OR b.name ILIKE q.l
        OR q.t = ANY(p.tags) OR (p.translations -> 'bn' ->> 'name') LIKE q.l
        OR (length(q.t) >= ${FUZZY_MIN_LENGTH} AND q.t <% p.name)
      )
    GROUP BY p.id`
  return new Map(rows.map((r) => [r.id, r.score]))
}


/** Online store > Search words: groups of words that mean the same, saved as a whole list. */
export const SearchWordsDto = z.object({
  groups: z
    .array(
      z
        .array(z.string().transform(norm).pipe(z.string().min(1).max(40, "Keep each word under 40 letters")))
        .transform((ws) => [...new Set(ws)])
        .refine((ws) => ws.length >= 2 && ws.length <= 20, "A group needs 2 to 20 different words"),
    )
    .max(300),
})
export type SearchWordsDto = z.infer<typeof SearchWordsDto>

export async function listSearchWords(storeId: bigint) {
  const rows = await prisma.searchSynonym.findMany({ where: { storeId }, orderBy: { id: "asc" }, select: { words: true } })
  return { groups: rows.map((r) => r.words) }
}

export async function saveSearchWords(storeId: bigint, dto: SearchWordsDto) {
  await prisma.$transaction([
    prisma.searchSynonym.deleteMany({ where: { storeId } }),
    prisma.searchSynonym.createMany({ data: dto.groups.map((words) => ({ storeId, words })) }),
  ])
  return listSearchWords(storeId)
}
