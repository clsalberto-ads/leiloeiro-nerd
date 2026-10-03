import { formatBRL } from "./format-brl";

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
