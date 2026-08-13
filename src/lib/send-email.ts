export type TransactionalEmailPayload = {
  run_id?: string;
  to: string;
  from?: string;
  sender_domain?: string;
  subject: string;
  html?: string;
  text?: string;
  purpose?: string;
  label?: string;
  idempotency_key?: string;
  unsubscribe_token?: string;
  message_id?: string;
};

type SendEmailOptions = {
  apiKey?: string;
  sendUrl?: string;
};

/** Sends transactional email via configurable HTTP API (Resend-compatible by default). */
export async function sendTransactionalEmail(
  payload: TransactionalEmailPayload,
  opts: SendEmailOptions = {},
): Promise<void> {
  const apiKey = opts.apiKey ?? process.env.RESEND_API_KEY ?? process.env.EMAIL_API_KEY;
  const sendUrl =
    opts.sendUrl ??
    process.env.EMAIL_SEND_URL ??
    process.env.RESEND_SEND_URL ??
    "https://api.resend.com/emails";

  if (!apiKey) {
    throw new Error("EMAIL_API_KEY / RESEND_API_KEY не е конфигуриран на сървъра.");
  }

  const from =
    payload.from ??
    process.env.EMAIL_FROM ??
    `Имоти Надежда <noreply@${payload.sender_domain ?? "imotinadezhda.bg"}>`;

  const res = await fetch(sendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(payload.idempotency_key ? { "Idempotency-Key": payload.idempotency_key } : {}),
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      tags: payload.label ? [{ name: "label", value: payload.label }] : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Email send failed (${res.status}): ${text.slice(0, 500)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
}
