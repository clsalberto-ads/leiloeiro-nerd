// ponytail: a unica diferenca entre o `searchParams` do Next
// (`string | string[] | undefined`) e o `URLSearchParams` do cliente e o
// parametro REPETIDO: `?page=2&page=9` chega no Next como array e o
// `URLSearchParams.get` do navegador devolveria so o primeiro.
//
// A escolha aqui e "o primeiro vence", porque e a que o `URLSearchParams.get`
// faz. O servidor e o cliente concordam em vez de divergir no parametro
// duplicado, que e um link malformado de qualquer jeito.
//
// Nasceu em `items/page.tsx` e foi copiado para `dashboard/period/period.ts`
// quando a pagina do dashboard ganhou o `?periodo` — e a copia foi ate
// documentada como tal, que e o jeito de dizer "aqui esta a duplicacao". Com dois
// call sites, um modulo so.
export function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}