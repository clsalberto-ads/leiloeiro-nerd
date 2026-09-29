import { describe, expect, it } from "vitest";
import { renderOutbidEmail } from "./email-templates";

// ponytail: o e-mail e o UNICO sink do app que nao escapa. `bidderName` e
// `itemTitle` renderizam por JSX em todo o resto (bid-history, public-item-card,
// vitrines) e escapam de graca; aqui eles iam crus para o HTML. O `itemTitle` e
// do VENDEDOR, com `z.string().min(3).max(150)` e sem restricao de charset, e o
// e-mail sai de `noreply@leiloeironerd.com` — ou seja, um `<a href>` no titulo
// virava um link de phishing dentro de uma mensagem que herda a confianca do
// dominio da marca, entregue a cada arrematante que fosse superado.
//
// Estes testes travam a ESCAPAGEM, nao a sanitizacao: nao ha markup legitimo no
// template, so texto, entao o certo e neutralizar na entrada.
describe("renderOutbidEmail", () => {
  const base = {
    bidderName: "Ana",
    itemTitle: "Console retrô",
    oldAmount: 5000,
    newAmount: 6500,
    itemUrl: "http://localhost:3000/loja/item1",
  };

  it("mantem o texto normal intacto", () => {
    const html = renderOutbidEmail(base);
    expect(html).toContain("Ana");
    expect(html).toContain("Console retrô");
    expect(html).toContain("R$ 50,00");
    expect(html).toContain("R$ 65,00");
  });

  it("escapa a tag do titulo, para nao virar HTML no e-mail", () => {
    const html = renderOutbidEmail({ ...base, itemTitle: '<a href="https://atacker.tld">Clique aqui</a>' });
    expect(html).not.toContain("<a href=\"https://atacker.tld\">");
    expect(html).toContain("&lt;a href=&quot;https://atacker.tld&quot;&gt;");
  });

  it("escapa o nome do arrematante", () => {
    const html = renderOutbidEmail({ ...base, bidderName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapa aspas no href, para nao quebrar o atributo", () => {
    const html = renderOutbidEmail({ ...base, itemUrl: 'http://x/"onmouseover="alert(1)' });
    expect(html).not.toContain('"onmouseover="alert(1)');
  });

  it("escapa o e comercial, senao a entidade nasce errada", () => {
    // `&lt;` escrito pelo autor precisa sobreviver como `&amp;lt;` —escapar
    // `&` por ultimo (ou nao escapar) faria `&lt;script&gt;` virar a tag de novo.
    const html = renderOutbidEmail({ ...base, itemTitle: "&lt;script&gt;" });
    expect(html).toContain("&amp;lt;script&amp;gt;");
    expect(html).not.toContain("<script>");
  });
});
