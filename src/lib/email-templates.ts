import { formatReais } from "@/lib/format-reais";

// ponytail: o e-mail e o UNICO sink do app que nao escapa. Todo o resto renderiza
// `bidderName`/`itemTitle` via JSX, que escapa sozinho; aqui a interpolacao vai
// crua para o HTML, e os dois campos sao do usuario (o `itemTitle` e do vendedor,
// com `z.string().min(3).max(150)` e sem restricao de charset). Um titulo com
// `<a href="https://atacker.tld">` viraria um link de phishing dentro de um
// e-mail real enviado de `noreply@leiloeironerd.com`, com a confianca do dominio
// da marca. Escapar na entrada e o ponto — nao existe sanitizador de HTML no
// projeto, e nao faz falta: nao ha markup legitimo no template, so texto.
const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function renderOutbidEmail(data: {
  bidderName: string;
  itemTitle: string;
  oldAmount: number;
  newAmount: number;
  itemUrl: string;
}): string {
  return `
    <p>Olá ${esc(data.bidderName)},</p>
    <p>Seu lance de <strong>R$ ${formatReais(data.oldAmount)}</strong> em <strong>${esc(data.itemTitle)}</strong> foi superado por <strong>R$ ${formatReais(data.newAmount)}</strong>.</p>
    <p><a href="${esc(data.itemUrl)}" style="color: #3b82f6;">Dar novo lance</a></p>
  `;
}
