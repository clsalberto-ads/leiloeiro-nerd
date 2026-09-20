import { formatReais } from "@/lib/format-reais";

export function renderOutbidEmail(data: {
  bidderName: string;
  itemTitle: string;
  oldAmount: number;
  newAmount: number;
  itemUrl: string;
}): string {
  return `
    <p>Olá ${data.bidderName},</p>
    <p>Seu lance de <strong>R$ ${formatReais(data.oldAmount)}</strong> em <strong>${data.itemTitle}</strong> foi superado por <strong>R$ ${formatReais(data.newAmount)}</strong>.</p>
    <p><a href="${data.itemUrl}" style="color: #3b82f6;">Dar novo lance</a></p>
  `;
}