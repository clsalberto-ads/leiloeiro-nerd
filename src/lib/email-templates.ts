export function renderOutbidEmail(data: {
  bidderName: string;
  itemTitle: string;
  oldAmount: number;
  newAmount: number;
  itemUrl: string;
}): string {
  const reais = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
  return `
    <p>Olá ${data.bidderName},</p>
    <p>Seu lance de <strong>R$ ${reais(data.oldAmount)}</strong> em <strong>${data.itemTitle}</strong> foi superado por <strong>R$ ${reais(data.newAmount)}</strong>.</p>
    <p><a href="${data.itemUrl}" style="color: #3b82f6;">Dar novo lance</a></p>
  `;
}