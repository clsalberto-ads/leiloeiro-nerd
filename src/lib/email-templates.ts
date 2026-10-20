import { formatBRL } from "./format-brl";
import { APP_TIMEZONE } from "./timezone";

// ponytail: o e-mail é o ÚNICO destino do app que não escapa automaticamente.
// Todo o resto renderiza `src/app` via JSX, que escapa sozinho;
// aqui a interpolação entra crua no HTML, e os dois campos são controlados pelo
// usuário (vem do seller, com `<` e sem
// restrição de charset). Um título como `<b>` viraria
// um link de phishing dentro de um e-mail real enviado de `RESEND`,
// com a confiança do domínio da marca. Escapar na origem é a correção — não há
// sanitizador de HTML no projeto, e não é necessário: não existe marcação legítima
// no template, só texto.
// A ordem importa: usamos um placeholder para o & a fim de não escapar duas
// vezes as entidades que acabamos de criar.
// ponytail: as entidades HTML são escritas como `\x26amp;` (o "&") para que a string
// contenha literalmente `\x26` em vez de virar o caractere "<" já na criação.
const LT = "\x26lt;";    // "<"
const GT = "\x26gt;";    // ">"
const QUOT = "\x26quot;"; // "\""
const APOS = "\x26apos;"; // "'"
const AMP = "\x26amp;";   // "&"
const AMP_PLACEHOLDER = "\u0001"; // Control char unlikely to appear in input

const esc = (v: string) =>
  v
    .replace(/&/g, AMP_PLACEHOLDER)  // Protect existing & first
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT)
    .replace(/'/g, APOS)
    .replace(new RegExp(AMP_PLACEHOLDER, "g"), AMP);  // Restore & as &

export function renderOutbidEmail(data: {
  bidderName: string;
  itemTitle: string;
  oldAmount: number;
  newAmount: number;
  itemUrl: string;
}): string {
  return `
    <p>Olá ${esc(data.bidderName)},</p>
    <p>Seu lance de <strong>R$ ${formatBRL(data.oldAmount)}</strong> em <strong>${esc(data.itemTitle)}</strong> foi superado por <strong>R$ ${formatBRL(data.newAmount)}</strong>.</p>
    <p><a href="${esc(data.itemUrl)}" style="color: #3b82f6;">Dar novo lance</a></p>
  `;
}

// ponytail: os templates de PAGAMENTO da Fase 3. Todos seguem o desenho do
// `renderOutbidEmail`: HTML mínimo, campos controlados pelo usuário escapados
// por `esc`, dinheiro em centavos via `formatBRL` (pt-BR: R$ 1.234,56) e
// links azuis para a ação. O `paymentUrl` aponta para /dashboard/payments/[id]
// — que é do ARREMATANTE; os templates de fim de fluxo (confirmado/expirado)
// linkam o painel, porque a página de pagamento dele ainda é o registro do
// acontecido.
interface PaymentEmailData {
  bidderName: string;
  itemTitle: string;
  amount: number;
  paymentUrl: string;
}

export function renderPaymentDueEmail(data: {
  bidderName: string;
  itemTitle: string;
  amount: number;
  deadline: Date;
  paymentUrl: string;
}): string {
  const prazo = data.deadline.toLocaleString("pt-BR", { timeZone: APP_TIMEZONE, dateStyle: "short", timeStyle: "short" });
  return `
    <p>Olá ${esc(data.bidderName)},</p>
    <p>Seu pagamento de <strong>R$ ${formatBRL(data.amount)}</strong> pelo item <strong>${esc(data.itemTitle)}</strong> vence em <strong>${esc(prazo)}</strong>.</p>
    <p>Não perca o arremato: <a href="${esc(data.paymentUrl)}" style="color: #3b82f6;">Pagar agora</a></p>
  `;
}

export function renderPaymentConfirmedEmail(data: PaymentEmailData): string {
  return `
    <p>Olá ${esc(data.bidderName)},</p>
    <p>Recebemos o pagamento de <strong>R$ ${formatBRL(data.amount)}</strong> pelo item <strong>${esc(data.itemTitle)}</strong>. Parabéns pelo arremato!</p>
    <p><a href="${esc(data.paymentUrl)}" style="color: #3b82f6;">Ver comprovante</a></p>
  `;
}

export function renderPaymentExpiredEmail(data: PaymentEmailData): string {
  return `
    <p>Olá ${esc(data.bidderName)},</p>
    <p>O prazo para pagar <strong>R$ ${formatBRL(data.amount)}</strong> pelo item <strong>${esc(data.itemTitle)}</strong> venceu e a cobrança foi encerrada.</p>
    <p><a href="${esc(data.paymentUrl)}" style="color: #3b82f6;">Acompanhar no painel</a></p>
  `;
}

export function renderNextBidderCalledEmail(data: {
  bidderName: string;
  itemTitle: string;
  amount: number;
  deadline: Date;
  paymentUrl: string;
}): string {
  const prazo = data.deadline.toLocaleString("pt-BR", { timeZone: APP_TIMEZONE, dateStyle: "short", timeStyle: "short" });
  return `
    <p>Olá ${esc(data.bidderName)},</p>
    <p>O arrematante anterior não pagou o item <strong>${esc(data.itemTitle)}</strong>. Você está na sequência!</p>
    <p>Pague <strong>R$ ${formatBRL(data.amount)}</strong> até <strong>${esc(prazo)}</strong>: <a href="${esc(data.paymentUrl)}" style="color: #3b82f6;">Pagar o arremate</a></p>
  `;
}
