/**
 * ADMIN PREFERENCES — how each staff member likes the admin: bookmarked pages and text size.
 * Kept on the account, so they follow the person to any device.
 *   GET /api/admin/me/preferences
 *   PUT /api/admin/me/preferences   { bookmarks?, textSize? } (each part replaces what's stored)
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../../config"
import { UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, validate } from "../../middleware"

export const MAX_BOOKMARKS = 12
export const TEXT_SIZES = ["sm", "md", "lg"] as const

const Bookmark = z.object({
  /** A page in the admin: a path, never another site. */
  href: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/(?!\/)/, "Bookmarks are pages in the admin"),
  label: z.string().trim().min(1).max(80),
})
export const PreferencesDto = z.object({
  bookmarks: z
    .array(Bookmark)
    .max(MAX_BOOKMARKS, `Up to ${MAX_BOOKMARKS} bookmarks`)
    .refine(
      (b) => new Set(b.map((x) => x.href)).size === b.length,
      "That page is already bookmarked",
    )
    .optional(),
  textSize: z.enum(TEXT_SIZES).optional(),
})
export interface Preferences {
  bookmarks: z.infer<typeof Bookmark>[]
  textSize: (typeof TEXT_SIZES)[number]
}

/** What's stored, with anything unreadable (an older shape) dropped. */
export function readPreferences(raw: unknown): Preferences {
  const ok = PreferencesDto.safeParse(raw ?? {})
  return {
    bookmarks: ok.success ? (ok.data.bookmarks ?? []) : [],
    textSize: ok.success ? (ok.data.textSize ?? "md") : "md",
  }
}

type Req = Request & { ctx: RequestContext }
const who = (req: Req) => {
  const id = req.ctx.admin?.id
  if (!id) throw new UnauthorizedError("Staff only", "AUTH_MISSING_TOKEN")
  return BigInt(id)
}

export const adminPreferencesRouter = Router()
adminPreferencesRouter.use(authMiddleware("admin"))

adminPreferencesRouter.get(
  "/",
  ctrl(async (req: Req, res: Response) => {
    const u = await prisma.adminUser.findUnique({
      where: { id: who(req) },
      select: { preferences: true },
    })
    envelope(res, { data: readPreferences(u?.preferences) })
  }),
)
adminPreferencesRouter.put(
  "/",
  validate({ body: PreferencesDto }),
  ctrl(async (req: Req, res: Response) => {
    const id = who(req)
    const u = await prisma.adminUser.findUnique({ where: { id }, select: { preferences: true } })
    const next = {
      ...readPreferences(u?.preferences),
      ...(req.body as z.infer<typeof PreferencesDto>),
    }
    await prisma.adminUser.update({
      where: { id },
      data: { preferences: next },
    })
    envelope(res, { data: next })
  }),
)
