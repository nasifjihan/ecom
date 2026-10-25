import { describe, expect, it, vi } from "vitest"
import globalErrorHandler from "../../src/middleware/14-global-error-handler"

// Runs as NODE_ENV=test, so not dev: unexpected errors keep their wording to themselves.
function answer(err: unknown): { status: unknown; body: unknown } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    locals: {},
  }
  globalErrorHandler(err, { path: "/api/x", requestId: "r1" } as never, res as never, vi.fn())
  return { status: res.status.mock.calls[0]?.[0] as unknown, body: res.json.mock.calls[0]?.[0] as unknown }
}

describe("global error handler", () => {
  it("answers a non-numeric id with 400, not 500", () => {
    let err: unknown
    try {
      BigInt("abc")
    } catch (e) {
      err = e
    }
    expect(answer(err)).toMatchObject({
      status: 400,
      body: { code: "BAD_REQUEST", message: "Invalid id" },
    })
  })

  it("hides an unexpected error's wording", () => {
    const { status, body } = answer(new Error('relation "Secret" does not exist'))
    expect(status).toBe(500)
    expect(JSON.stringify(body)).not.toContain("Secret")
  })
})
