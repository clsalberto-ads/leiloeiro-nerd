import { Resend } from "resend";
import { renderOutbidEmail } from "@/lib/email-templates";

export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendOutbidEmail(
  resend: Resend,
  to: string,
  data: { bidderName: string; itemTitle: string; oldAmount: number; newAmount: number; itemUrl: string },
) {
  const html = renderOutbidEmail(data);
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Leiloeiro Nerd <noreply@leiloeironerd.com>",
    to,
    subject: "Seu lance foi superado!",
    html,
  });
}