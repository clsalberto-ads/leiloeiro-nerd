// Formata um valor inteiro em centavos como string de moeda BRL.
// Exemplo: 123456 -> "1.234,56"
export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}