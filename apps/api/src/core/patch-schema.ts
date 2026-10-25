import { z } from "zod";

type Bare<T> = T extends z.ZodDefault<infer I> ? Bare<I> : T extends z.ZodOptional<infer I> ? Bare<I> : T;

/**
 * A field without its .default() (and the .optional() around it); a nullable field keeps null.
 * A .refine() written after .default() sits on the wrapper in zod 4, so it moves to the inner schema.
 */
function bare(t: z.ZodType): z.ZodType {
  if (t instanceof z.ZodOptional || t instanceof z.ZodDefault || t instanceof z.ZodNullable) {
    const inner = bare(t.unwrap() as z.ZodType);
    const checks = t._zod.def.checks ?? [];
    const kept = checks.length ? inner.check(...(checks as z.core.$ZodCheck<unknown>[])) : inner;
    return t instanceof z.ZodNullable ? kept.nullable() : kept;
  }
  return t;
}

/**
 * The body of an update (PATCH): every field optional, and no defaults. Zod 4's .partial() fills in
 * .default() values for fields that weren't sent, so an update would reset them (status back to
 * "draft", tags emptied). Use this instead of .partial() on any schema with defaults.
 */
export function patchOf<S extends z.ZodRawShape>(schema: z.ZodObject<S>) {
  return z.object(
    Object.fromEntries(Object.entries(schema.shape).map(([k, v]) => [k, bare(v as z.ZodType).optional()])) as unknown as {
      [K in keyof S]: z.ZodOptional<Bare<S[K]>>;
    },
  );
}
