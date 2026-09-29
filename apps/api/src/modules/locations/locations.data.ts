/**
 * Loads the bundled Bangladesh location tree (prisma/data/bd-locations.json) into the
 * Location table. Adds missing rows and fixes changed names; never deletes, so ids that
 * addresses, orders and zones point at stay valid.
 */
import { readFileSync } from "node:fs";
import type { LocationType, PrismaClient } from "@prisma/client";

type Node = { code: string; type: LocationType; en: string; bn: string; children?: Node[] };

const DATA_URL = new URL("../../../prisma/data/bd-locations.json", import.meta.url);

export function readLocationTree(): Node[] {
  return (JSON.parse(readFileSync(DATA_URL, "utf8")) as { divisions: Node[] }).divisions;
}

export async function syncLocations(db: PrismaClient): Promise<{ created: number; updated: number }> {
  const existing = await db.location.findMany({
    select: { id: true, code: true, nameEn: true, nameBn: true, sortOrder: true, parentId: true },
  });
  const byCode = new Map(existing.map((l) => [l.code, l]));
  let created = 0;
  let updated = 0;

  // Walk level by level so every parent exists (with an id) before its children are inserted.
  let level: { node: Node; parentCode: string | null; sort: number }[] =
    readLocationTree().map((node, sort) => ({ node, parentCode: null, sort }));
  while (level.length) {
    const toCreate = level.filter(({ node }) => !byCode.has(node.code));
    if (toCreate.length) {
      await db.location.createMany({
        data: toCreate.map(({ node, parentCode, sort }) => ({
          code: node.code,
          type: node.type,
          nameEn: node.en,
          nameBn: node.bn,
          sortOrder: sort,
          parentId: parentCode ? byCode.get(parentCode)!.id : null,
        })),
        skipDuplicates: true,
      });
      const fresh = await db.location.findMany({
        where: { code: { in: toCreate.map(({ node }) => node.code) } },
        select: { id: true, code: true, nameEn: true, nameBn: true, sortOrder: true, parentId: true },
      });
      for (const l of fresh) byCode.set(l.code, l);
      created += toCreate.length;
    }
    for (const { node, sort } of level) {
      const row = byCode.get(node.code)!;
      if (row.nameEn !== node.en || row.nameBn !== node.bn || row.sortOrder !== sort) {
        await db.location.update({ where: { id: row.id }, data: { nameEn: node.en, nameBn: node.bn, sortOrder: sort } });
        updated++;
      }
    }
    level = level.flatMap(({ node }) =>
      (node.children ?? []).map((child, sort) => ({ node: child, parentCode: node.code, sort })),
    );
  }
  return { created, updated };
}

/** Older spellings still found in saved addresses and zones, mapped to the names we store. */
export const LEGACY_NAMES: Record<string, string> = {
  chittagong: "chattogram",
  chattagram: "chattogram",
  barisal: "barishal",
  comilla: "cumilla",
  coxsbazar: "cox's bazar",
  "coxs bazar": "cox's bazar",
  jessore: "jashore",
  bogra: "bogura",
  jhalakathi: "jhalokati",
  jhalakati: "jhalokati",
};

export const normalizeName = (name: string) => {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return LEGACY_NAMES[n] ?? n;
};
