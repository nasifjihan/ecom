/**
 * Sending a WhatsApp template message through Meta's WhatsApp Cloud API:
 *   POST https://graph.facebook.com/v19.0/{phone-number-id}/messages   (Bearer access token)
 * The base URL can point elsewhere with WHATSAPP_API_URL (tests, a local mock). `fetch` is
 * injectable for tests.
 */
import { env } from "../../config"

export type Fetch = typeof fetch

export class WhatsappError extends Error {}

export interface CloudKeys {
  phoneNumberId: string
  accessToken: string
}

const base = () =>
  (env.WHATSAPP_API_URL?.trim()
    ? env.WHATSAPP_API_URL.trim()
    : "https://graph.facebook.com/v19.0"
  ).replace(/\/$/, "")

/** Sends an approved template; returns Meta's message id (wamid…). Throws WhatsappError with Meta's reason. */
export async function sendTemplate(
  keys: CloudKeys,
  to: string,
  template: { name: string; language: string; params: string[] },
  f: Fetch = fetch,
): Promise<string> {
  let res: Response
  try {
    res = await f(`${base()}/${encodeURIComponent(keys.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          ...(template.params.length
            ? {
                components: [
                  {
                    type: "body",
                    parameters: template.params.map((text) => ({ type: "text", text })),
                  },
                ],
              }
            : {}),
        },
      }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    throw new WhatsappError(
      (e as Error).name === "TimeoutError"
        ? "WhatsApp didn't answer in time"
        : `Couldn't reach WhatsApp (${(e as Error).message})`,
    )
  }
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id?: string }[]
    error?: { message?: string; code?: number; error_data?: { details?: string } }
  }
  const id = json.messages?.[0]?.id
  if (!res.ok || !id) {
    const e = json.error
    const why =
      e?.error_data?.details ?? e?.message ?? `WhatsApp refused the message (${res.status})`
    // 131026: not a WhatsApp number; 132001: the template doesn't exist in that language.
    throw new WhatsappError(e?.code ? `${why} (code ${e.code})` : why)
  }
  return id
}
