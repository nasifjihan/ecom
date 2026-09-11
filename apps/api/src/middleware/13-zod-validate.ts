/**
 * 13 — ZOD VALIDATION.
 * Validates req.params / req.query / req.body schemas.
 * On failure: 422 with errors = { field: [messages] }, consumed by frontend react-hook-form.
 *
 * Usage example:
 *   router.post("/", validate({ body: CreateProductDto, query: PaginationSchema }), controller.create)
 */
import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";
import { ValidationError } from "../core";

type Targets = {
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
};

export default function validate(schemas: Targets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};

    for (const target of ["params", "query", "body"] as const) {
      const schema = schemas[target];
      if (!schema) continue;
      const result = schema.safeParse((req as any)[target]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path.join(".") || "_";
          errors[key] ||= [];
          errors[key].push(issue.message);
        }
      } else {
        (req as any)[target] = result.data;
      }
    }

    if (Object.keys(errors).length) {
      return next(new ValidationError(errors));
    }
    next();
  };
}
