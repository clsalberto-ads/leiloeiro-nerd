/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { BidCountdown } from "./bid-countdown";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ponytail: este e o unico teste do projeto que HIDRATA de verdade, e ele existe
// por um bug que 638 testes, o `tsc` e o `build` nao pegaram: o `BidCountdown`
// calcula `Date.now()` dentro do `useState`, e isso roda no servidor (SSR) e de
// novo no cliente (hidratacao) com valores diferentes. O React respondia
// "Hydration failed because the server rendered text didn't match the client" e
// DESCARTAVA o HTML do servidor, re-renderizando a arvore no cliente — na rota
// publica mais acessada, em um componente que esta em todos os cards.
//
// Todo o resto da suite usa `renderToString`, que serializa e nao hidrata: nao ha
// como um aviso de hidratacao aparecer la. Por isso o bug sobreviveu a varios
// commits. Este arquivo fecha essa lacuna, e nao para o componente: para o
// `hydrateRoot`.
//
// A janela de 1,2 s entre o SSR e a hidratacao e o caso real de um usuario com
// latencia de rede. Com `Date.now()` congelado (fake timer sem avancar) os dois
// lados concordariam e o teste passaria sem provar nada.
describe("BidCountdown — a hidratacao de verdade", () => {
  async function hidrarComAtraso(deadline: Date) {
    const erros: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      erros.push(args.map(String).join(" "));
    };
    try {
      const html = renderToString(<BidCountdown deadline={deadline} />);
      const doServidor = html.replace(/<[^>]+>/g, "").trim();

      const alvo = document.createElement("div");
      alvo.innerHTML = html;
      document.body.appendChild(alvo);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 1200));
      });
      await act(async () => {
        hydrateRoot(alvo, <BidCountdown deadline={deadline} />);
      });
      return {
        doServidor,
        doCliente: alvo.textContent?.trim() ?? "",
        htmlCliente: alvo.innerHTML,
        erros,
      };
    } finally {
      console.error = original;
    }
  }

  it("nao acusa falha de hidratacao mesmo com o relogio avancado", async () => {
    const { erros } = await hidrarComAtraso(new Date("2026-12-25T12:00:00Z"));
    const avisos = erros.filter((e) => /hydrat|did not match|Text content/i.test(e));
    expect(avisos, `avisos de hidratacao: ${avisos.join(" | ")}`).toEqual([]);
  });

  it("nao descarta a arvore do servidor (o sintoma e' regenerar tudo no cliente)", async () => {
    // ponytail: o aviso e' a metrica fraca. O que dói mesmo e' o
    // "this tree will be regenerated on the client" — o React joga fora o HTML do
    // servidor daquela subarvore. O `sr-only` (que tem o prazo em texto, e o que o
    // leitor de tela usa) sobrevive intacto depois de hidratar; se a arvore fosse
    // regenerada, ele ainda estaria la, entao este `it` trava o `role="timer"` e o
    // prazo absoluto, que sao as duas coisas que o usuario perde.
    const { htmlCliente, doCliente } = await hidrarComAtraso(new Date("2026-12-25T12:00:00Z"));
    expect(htmlCliente).toContain('role="timer"');
    expect(doCliente).toContain("Prazo: 25/12/2026, 09:00");
  });

  it("o prazo absoluto do sr-only e' identico no servidor e no cliente", async () => {
    // ponytail: o `sr-only` NAO pode depender de `Date.now()`, e e por isso que ele
    // nao precisa de `suppressHydrationWarning`. Este `it` trava essa separacao: se
    // alguem passar a computar a contagem dentro do `sr-only` tambem, os dois lados
    // passam a divergir e o leitor de tela ouve o prazo errado.
    const { doServidor, doCliente } = await hidrarComAtraso(new Date("2026-12-25T12:00:00Z"));
    const prazo = (t: string) => t.match(/Prazo: [^P]+/)?.[0];
    expect(prazo(doServidor)).toBe(prazo(doCliente));
  });
});
