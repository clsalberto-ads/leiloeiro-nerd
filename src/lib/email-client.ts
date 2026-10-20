// ponytail: a porta de e-mail dos fluxos de PAGAMENTO — o mesmo desenho do
// `ResendClient` do placeBid (frouxo de propósito, para não acoplar o use case
// ao SDK), extraída para um módulo porque agora são TRÊS use cases que enviam
// (webhook, cascata, lembrete) e a cópia triplicada seria o mesmo defeito que
// o projeto vem desarmando.
//
// O envio é OPCIONAL nas deps (`null`/ausente = pular com log): sem
// RESEND_API_KEY o fluxo de pagamento continua ÍNTEGRO — e-mail é best-effort,
// a escrita no banco é a que não pode falhar.
export interface TransactionalEmailClient {
  emails: {
    send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown>;
  };
}

/**
 * O endereço de remetente, com o mesmo default do placeBid.
 */
export function emailFrom(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Leiloeiro Nerd <noreply@leiloeironerd.com>";
}

/** Base pública para links dos e-mails (default de desenvolvimento). */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Envia um e-mail transacional. É o ÚNICO ponto que conversa com o cliente e
 * trata as DUAS formas de a Resend falhar: ela NÃO lança em erro de API
 * (devolve `{ data, error }`), e lança em falha de rede — o mesmo cuidado
 * documentado no placeBid. Erros aqui são ENGOLIDOS de propósito: o chamador
 * passou um try/catch por cima mesmo assim, mas o log distingue o caso.
 */
export async function sendEmailBestEffort(
  client: TransactionalEmailClient,
  args: { to: string; subject: string; html: string },
): Promise<void> {
  const result = await client.emails.send({ from: emailFrom(), ...args });
  if (
    result &&
    typeof result === "object" &&
    "error" in result &&
    (result as { error?: unknown }).error
  ) {
    console.error("[email] Resend recusou o envio:", (result as { error: unknown }).error);
  }
}
