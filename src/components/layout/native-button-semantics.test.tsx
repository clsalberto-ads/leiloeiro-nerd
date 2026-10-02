// @vitest-environment jsdom
import Link from "next/link";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "./app-header";
import { DashboardSidebar } from "./dashboard-sidebar";
import { Button } from "@/components/ui/button";

// ponytail: `src/components/ui/button.tsx` fixa `nativeButton={true}` no
// `ButtonPrimitive`. Essa prop tem que DESCREVER o elemento que o `render`
// produziu: `true` para `<button>`, `false` para `<a>`/`<div>`. Um `Button` com
// `render={<Link/>}` renderiza um `<a>`, entao com `nativeButton={true}` a Base UI
// reclama que perdeu a semantica nativa de botao.
//
// O aviso sai num `useEffect`, ou seja, so no cliente — por isso jsdom e
// `render()` da testing-library. Um `renderToStaticMarkup` (o padrao dos outros
// testes deste repo) passa batido e nao pega nada.
const WARNING = "expected a native <button>";

let espiar: ReturnType<typeof vi.spyOn>;

function avisou() {
  return espiar.mock.calls.some(([arg]) => String(arg).includes(WARNING));
}

describe("Button que renderiza Link precisa declarar nativeButton={false}", () => {
  beforeEach(() => {
    espiar = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ponytail: o auto-cleanup do testing-library so se registra com
  // `globals: true` no vitest, e o `vitest.config.ts` deste repo nao tem. Sem o
  // `cleanup` explicito os componentes ficam montados apos o teste e o scheduler
  // do React dispara no ambiente ja derrubado: "window is not defined".
  afterEach(() => {
    cleanup();
    espiar.mockRestore();
  });

  it("o Button avisa quando o render nao produz um <button> e o nativeButton e true", () => {
    render(
      <Button render={<Link href="/x" />}>
        Link
      </Button>
    );

    // Este caso e o que fixa o SINTOMA: se a Base UI deixar de avisar (versao nova,
    // prop removida, erro sumindo), este teste avisa que a protecao inteira
    // virou decoracao. Sem ele, os testes de abaixo passariam a vacuosamente.
    expect(avisou()).toBe(true);
  });

  it("com nativeButton={false} o mesmo Button nao avisa", () => {
    render(
      <Button render={<Link href="/x" />} nativeButton={false}>
        Link
      </Button>
    );

    expect(avisou()).toBe(false);
  });

  // ponytail: os shells sao oslugares onde o padrao se repete — sidebar com 3
  // destinos, header com 2 CTAs. Renderiza-los de verdade pega o padrao no lugar
  // onde ele foi usado, em vez de num Button sintetico que ninguem renderiza.
  it("a sidebar do dashboard nao perde a semantica de botao", () => {
    render(<DashboardSidebar />);

    expect(avisou()).toBe(false);
  });

  it("o header publico nao perde a semantica de botao", () => {
    render(<AppHeader />);

    expect(avisou()).toBe(false);
  });
});
