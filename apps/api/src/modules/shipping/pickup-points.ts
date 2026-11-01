/**
 * Pickup points (Settings > Shipping > Pickup points): places customers collect orders from,
 * free. An order picked up from one is packed from its warehouse, gets no courier, and the
 * customer is told when staff mark it ready.
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../../config"
import { BadRequestError, NotFoundError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"

type Req = Request & { ctx: RequestContext }
const storeOf = (r: Req) => {
  if (r.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  return BigInt(r.ctx.storeId)
}
const text = (max: number) => z.string().trim().max(max)

export const PickupPointDto = z.object({
  name: text(80).min(2, "Give the pickup point a name"),
  address: text(300).min(5, "Write the address"),
  district: text(64).default(""),
  phone: text(30).optional().nullable(),
  hours: text(120).optional().nullable(),
  mapUrl: text(500)
    .refine((v) => v === "" || /^https:\/\//i.test(v), "Use a link starting with https://")
    .optional()
    .nullable(),
  readyInHours: z.coerce.number().int().min(0).max(720).default(24),
  warehouseId: z.coerce.bigint().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
})
export type PickupPointDto = z.infer<typeof PickupPointDto>

const view = (p: { id: bigint; warehouseId: bigint | null }) => ({ ...p, id: String(p.id), warehouseId: p.warehouseId ? String(p.warehouseId) : null })

async function checkWarehouse(storeId: bigint, warehouseId: bigint | null | undefined) {
  if (warehouseId && !(await prisma.warehouse.count({ where: { id: warehouseId, storeId } })))
    throw new BadRequestError("That warehouse isn't one of yours", "VALIDATION_FAILED")
}

/** The active pickup points shoppers can choose (checkout, contact page). */
export async function publicPickupPoints(storeId: bigint) {
  const rows = await prisma.pickupPoint.findMany({
    where: { storeId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, address: true, district: true, phone: true, hours: true, mapUrl: true, readyInHours: true },
  })
  return rows.map((r) => ({ ...r, id: String(r.id) }))
}

/** A point an order can be picked up from (active, this store's). */
export async function pickupPointFor(storeId: bigint, id: bigint | string) {
  const p = await prisma.pickupPoint.findFirst({ where: { id: BigInt(id), storeId, isActive: true } })
  if (!p) throw new BadRequestError("That pickup point isn't available. Please choose another.", "VALIDATION_FAILED")
  return p
}

export const adminPickupPointsRouter = Router()
adminPickupPointsRouter.use(authMiddleware("adminOrSuper"))

adminPickupPointsRouter.get(
  "/",
  rbacMiddleware("shipping.view"),
  ctrl(async (req: Req, res: Response) => {
    const rows = await prisma.pickupPoint.findMany({ where: { storeId: storeOf(req) }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
    envelope(res, { data: rows.map(view) })
  }),
)
adminPickupPointsRouter.post(
  "/",
  rbacMiddleware("shipping.create"),
  validate({ body: PickupPointDto }),
  ctrl(async (req: Req, res: Response) => {
    const storeId = storeOf(req)
    const dto = req.body as PickupPointDto
    await checkWarehouse(storeId, dto.warehouseId)
    envelope(res, { status: 201, data: view(await prisma.pickupPoint.create({ data: { ...dto, storeId } })), message: "Pickup point added" })
  }),
)
adminPickupPointsRouter.put(
  "/:id",
  rbacMiddleware("shipping.edit"),
  validate({ params: z.object({ id: z.coerce.bigint().positive() }), body: PickupPointDto }),
  ctrl(async (req: Req, res: Response) => {
    const storeId = storeOf(req)
    const id = (req.params as unknown as { id: bigint }).id
    const dto = req.body as PickupPointDto
    await checkWarehouse(storeId, dto.warehouseId)
    if (!(await prisma.pickupPoint.count({ where: { id, storeId } }))) throw new NotFoundError("Pickup point", id)
    envelope(res, { data: view(await prisma.pickupPoint.update({ where: { id }, data: dto })), message: "Pickup point saved" })
  }),
)
adminPickupPointsRouter.delete(
  "/:id",
  rbacMiddleware("shipping.delete"),
  validate({ params: z.object({ id: z.coerce.bigint().positive() }) }),
  ctrl(async (req: Req, res: Response) => {
    const id = (req.params as unknown as { id: bigint }).id
    const r = await prisma.pickupPoint.deleteMany({ where: { id, storeId: storeOf(req) } })
    if (!r.count) throw new NotFoundError("Pickup point", id)
    envelope(res, { data: { deleted: true }, message: "Pickup point removed" })
  }),
)
