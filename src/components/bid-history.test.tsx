import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { Bid } from "@/domain/repositories/bid-repository";
import { BidHistory } from "./bid-history";

// ponytail: 02:30Z de 01/10 e 23:30 de 30/09 em America/Sao_Paulo (UTC-3, sem
// horario de verao desde 2019). E o instante que separa os dois fusos: em UTC e
// "01/10/2026", no fuso do produto e "30/09/2026". Um lance caido nesse intervalo
// de uma hora mostra o dia errado no servidor de producao.
const LANCE_NA_BORDA: Bid = {
  id: "b1",
  itemId: "i1",
  bidderId: "u1",
  bidderName: "Ana",
  amount: 10000,
  rank: 1,
  createdAt: new Date("2026-10-01T02:30:00Z"),
};

function html(): string {
  return renderToString(<BidHistory bids={[LANCE_NA_BORDA]} />);
}

describe("BidHistory", () => {
  // ponytail: o `process.env.TZ = "UTC"` e o que faz este teste pegar o bug, e
  // ele e obrigatorio. A maquina de desenvolvimento roda em America/Fortaleza
  // (UTC-3), o mesmo offset de Sao Paulo hoje — la, com e sem `timeZone`, a
  // resposta e "30/09/2026" e o teste passa verde com o bug presente. Forcar o
  // processo em UTC e o que torna a ausencia do `timeZone` visivel: e o fuso real
  // de um servidor de producao. O Node invalida o cache de fuso do `Intl` quando
  // `process.env.TZ` e atribuido em runtime, entao a troca vale sem reiniciar o
  // worker.
  //
  // O `try/finally` protege o PROPRIO arquivo, e nao a suite: o vitest deste repo
  // roda com o default `pool: "forks"` + `isolate: true`, um processo filho por
  // arquivo, entao um `TZ` vazado aqui nao alcanca `items-list.test.tsx` nem
  // `bid-countdown.test.tsx`. O que ele protege e um `it` futuro neste arquivo,
  // que rodando depois deste veria `TZ=UTC` e leria qualquer data no dia errado.
  // O `delete` no caso `undefined` cobre a maquina que nao tem `TZ` setado: sem
  // ele o restauro gravaria a string `"undefined"` como fuso.
  it("renderiza a data do lance no fuso do produto, e nao no fuso do processo", () => {
    const fusoOriginal = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const saida = html();
      expect(saida).toContain("30/09/2026");
      expect(saida).not.toContain("01/10/2026");
    } finally {
      if (fusoOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = fusoOriginal;
    }
  });
});
