import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { sendTemplate, type Fetch } from "../../src/modules/whatsapp/whatsapp.provider"
import {
  nextStatus,
  signatureOk,
  statusUpdates,
  waEventSettings,
  waNumber,
  waParams,
} from "../../src/modules/whatsapp/whatsapp.rules"

describe("WhatsApp rules", () => {
  it("writes Bangladeshi mobiles the way WhatsApp wants them", () => {
    expect(waNumber("01712-345678")).toBe("8801712345678")
    expect(waNumber("+880 1712 345678")).toBe("8801712345678")
    expect(waNumber("0212345678")).toBeNull()
  })

  it("defaults every event to off, its own template name, English", () => {
    const s = waEventSettings(null)
    expect(s.order_shipped).toEqual({ enabled: false, template: "order_shipped", language: "en" })
    const custom = waEventSettings({
      order_placed: { enabled: true, template: "new_order_v2", language: "bn" },
      order_shipped: { template: "Bad Name!" },
    })
    expect(custom.order_placed).toEqual({ enabled: true, template: "new_order_v2", language: "bn" })
    expect(custom.order_shipped.template).toBe("order_shipped")
  })

  it("fills a template's values in order, with '-' for anything missing", () => {
    expect(
      waParams("order_shipped", {
        name: "Rahim",
        order: "20261022000001",
        courier: "Pathao",
        tracking: "",
      }),
    ).toEqual(["Rahim", "20261022000001", "Pathao", "-"])
    expect(
      waParams("order_placed", { name: "Rahim", order: "1", total: "৳1,250", store: "Fashion BD" }),
    ).toEqual(["Rahim", "1", "৳1,250", "Fashion BD"])
  })

  it("checks Meta's webhook signature against the exact bytes", () => {
    const body = Buffer.from('{"entry":[]}')
    const good = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`
    expect(signatureOk("app-secret", body, good)).toBe(true)
    expect(signatureOk("other-secret", body, good)).toBe(false)
    expect(signatureOk("app-secret", Buffer.from('{"entry": []}'), good)).toBe(false)
    expect(signatureOk("app-secret", body, undefined)).toBe(false)
    expect(signatureOk("app-secret", body, "sha1=abc")).toBe(false)
  })

  it("never lets a late status undo a later one", () => {
    expect(nextStatus("sent", "delivered")).toBe("delivered")
    expect(nextStatus("read", "delivered")).toBe("read")
    expect(nextStatus("sent", "failed")).toBe("failed")
    expect(nextStatus("delivered", "something")).toBe("delivered")
  })

  it("reads message statuses out of a webhook payload, and ignores incoming chats", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1098765" },
                statuses: [
                  { id: "wamid.A", status: "delivered" },
                  {
                    id: "wamid.B",
                    status: "failed",
                    errors: [{ title: "Not on WhatsApp", message: "Message failed to send" }],
                  },
                ],
                messages: [{ from: "8801712345678", text: { body: "hi" } }],
              },
            },
          ],
        },
      ],
    }
    expect(statusUpdates(payload)).toEqual([
      { phoneNumberId: "1098765", ref: "wamid.A", status: "delivered", error: null },
      {
        phoneNumberId: "1098765",
        ref: "wamid.B",
        status: "failed",
        error: "Message failed to send",
      },
    ])
    expect(statusUpdates({ nothing: true })).toEqual([])
  })
})

describe("sendTemplate", () => {
  const keys = { phoneNumberId: "1098765", accessToken: "EAAG-token" }
  const fake = (status: number, body: unknown) => {
    const calls: { url: string; init: RequestInit }[] = []
    const f = ((url: string, init: RequestInit) => {
      calls.push({ url, init })
      return Promise.resolve(new Response(JSON.stringify(body), { status }))
    }) as unknown as Fetch
    return { f, calls }
  }

  it("posts the template with its language and values, and returns Meta's message id", async () => {
    const { f, calls } = fake(200, {
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.HBgN" }],
    })
    expect(
      await sendTemplate(
        keys,
        "8801712345678",
        { name: "order_placed", language: "en", params: ["Rahim", "1001"] },
        f,
      ),
    ).toBe("wamid.HBgN")
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v19.0/1098765/messages")
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer EAAG-token",
    )
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "8801712345678",
      type: "template",
      template: {
        name: "order_placed",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Rahim" },
              { type: "text", text: "1001" },
            ],
          },
        ],
      },
    })
  })

  it("sends a template without values with no components (hello_world)", async () => {
    const { f, calls } = fake(200, { messages: [{ id: "wamid.X" }] })
    await sendTemplate(
      keys,
      "8801712345678",
      { name: "hello_world", language: "en_US", params: [] },
      f,
    )
    expect((JSON.parse(calls[0]!.init.body as string) as { template: unknown }).template).toEqual({
      name: "hello_world",
      language: { code: "en_US" },
    })
  })

  it("says why Meta refused it", async () => {
    const { f } = fake(400, {
      error: { message: "Template name does not exist in the translation", code: 132001 },
    })
    await expect(
      sendTemplate(keys, "8801712345678", { name: "nope", language: "bn", params: [] }, f),
    ).rejects.toThrow("Template name does not exist in the translation (code 132001)")
  })
})
