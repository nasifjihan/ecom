/**
 * API DOCS — GET /api/docs (Swagger UI) and GET /api/docs/openapi.json. On unless API_DOCS=off;
 * in production off unless API_DOCS=on. Built once per process (the routes don't change after start).
 */
import { Router, type Express, type Request, type Response } from "express"
import { env } from "../../config"
import { NotFoundError } from "../../core"
import { buildOpenApi } from "./openapi"

export const docsEnabled = () => (env.API_DOCS ? env.API_DOCS === "on" : env.NODE_ENV !== "production")

let cached: ReturnType<typeof buildOpenApi> | null = null

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>API docs</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css">
</head><body style="margin:0">
<div id="docs"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
<script src="/api/docs/start.js"></script>
</body></html>`

const START = `window.ui = SwaggerUIBundle({ url: "/api/docs/openapi.json", dom_id: "#docs", deepLinking: true, docExpansion: "none", filter: true, persistAuthorization: true });`

export const docsRouter = Router()

docsRouter.use((_req, _res, next) => (docsEnabled() ? next() : next(new NotFoundError("Route"))))

docsRouter.get("/openapi.json", (req: Request, res: Response) => {
  cached ??= buildOpenApi(req.app as Express)
  res.json(cached)
})

docsRouter.get("/start.js", (_req: Request, res: Response) => {
  res.type("application/javascript").send(START)
})

docsRouter.get("/", (_req: Request, res: Response) => {
  // The page loads Swagger UI from cdnjs; the API's own policy allows no outside scripts.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
  )
  res.type("html").send(PAGE)
})
