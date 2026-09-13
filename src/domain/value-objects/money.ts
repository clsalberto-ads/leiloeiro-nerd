export type Money = { readonly cents: number };

export function money(cents: number): Money {
  if (!Number.isInteger(cents)) throw new Error("Money deve ser em centavos inteiros");
  return { cents };
}

export function moneyFromReais(value: number): Money {
  if (!Number.isFinite(value) || value < 0) throw new Error("Valor em reais inválido");
  return money(Math.round(value * 100));
}

export function moneyToReais({ cents }: Money): number {
  return cents / 100;
}

export function moneyAdd(a: Money, b: Money): Money {
  return money(a.cents + b.cents);
}