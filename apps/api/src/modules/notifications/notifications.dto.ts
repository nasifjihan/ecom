import { z } from "zod"

export const TemplateKeyParamDto = z.object({ key: z.string().trim().min(1).max(60) })
export const IdParamDto = z.object({ id: z.coerce.bigint().positive() })

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(200)

/** Fields left out keep their current value. */
export const TemplateDto = z.object({
  enabled: z.boolean().optional(),
  subject: z.string().trim().min(1, "Add a subject").max(200).optional(),
  message: z.string().trim().min(1, "Add a message").max(10_000).optional(),
  /** Staff emails only: who gets them. Empty means the store owners. */
  recipients: z.array(email).max(10).optional(),
})
export type TemplateDto = z.infer<typeof TemplateDto>

/** Unsaved editor wording, for preview and test sends. */
export const DraftDto = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(10_000),
})
export const PreviewDto = z.object({ draft: DraftDto.optional() })
export const TestSendDto = z.object({ to: email.optional(), draft: DraftDto.optional() })

export const LogQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["queued", "sent", "retrying", "failed"]).optional(),
})
export type LogQueryDto = z.infer<typeof LogQueryDto>
