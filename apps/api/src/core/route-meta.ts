/**
 * What a middleware tells the API docs about the routes it guards: who may call them, the permission
 * they need and the shapes they accept. The auth, rbac and validate middleware tag the functions they
 * return; the docs builder (modules/docs) reads the tags off Express's route table.
 */
import type { z } from "zod"

export const ROUTE_META = Symbol.for("ecom.routeMeta")

export interface RouteMeta {
  auth?: string
  permissions?: string[]
  schemas?: { params?: z.ZodTypeAny; query?: z.ZodTypeAny; body?: z.ZodTypeAny }
}

export function tagRoute<T extends object>(fn: T, meta: RouteMeta): T {
  ;(fn as Record<symbol, RouteMeta>)[ROUTE_META] = meta
  return fn
}

export const routeMetaOf = (fn: unknown): RouteMeta | undefined =>
  typeof fn === "function" ? (fn as unknown as Record<symbol, RouteMeta | undefined>)[ROUTE_META] : undefined
