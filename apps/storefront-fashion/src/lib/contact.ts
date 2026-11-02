/** The contact form (API: modules/content/contact-messages.routes) and the SMS campaign stop link. */
import { api } from "@ecom/api-client";

export type ContactKind = "question" | "callback" | "order_problem";

export interface ContactInput {
  kind: ContactKind;
  name: string;
  phone?: string;
  email?: string;
  message: string;
  callbackTime?: string;
  orderNumber?: string;
  /** Hidden from people; a bot that fills it in is ignored. */
  website?: string;
}

const contactApi = api.injectEndpoints({
  endpoints: (b) => ({
    sendContact: b.mutation<{ ok: boolean }, ContactInput>({
      query: (body) => ({ url: "/storefront/contact", method: "POST", body }),
    }),
    stopSms: b.mutation<{ ok: boolean }, string>({
      query: (token) => ({ url: `/storefront/sms-stop/${encodeURIComponent(token)}`, method: "POST" }),
    }),
  }),
  overrideExisting: false,
});

export const { useSendContactMutation, useStopSmsMutation } = contactApi;
