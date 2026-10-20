import { describe, expect, it } from "vitest";
import { renderOutbidEmail, renderPaymentDueEmail, renderPaymentConfirmedEmail, renderPaymentExpiredEmail, renderNextBidderCalledEmail } from "./email-templates";

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

// ponytail: os QUATRO templates de pagamento da Fase 3. Mesmo contrato do
// outbid: conteúdo pt-BR com dinheiro formatado (centavos → R$ 1.234,56) e
// ESCAPAGEM dos campos controlados pelo usuário (título do item é do
// vendedor; nome vem do cadastro). O link de ação é o que muda por template.
describe("templates de pagamento", () => {
  const base = {
    bidderName: "Ana",
    itemTitle: "Console <b>raro</b>",
    amount: 10_000,
    paymentUrl: "http://localhost:3000/dashboard/payments/p1",
  };
  const deadline = new Date("2026-10-23T12:00:00Z");

  it("payment_due: avisa prazo e escapa o título", () => {
    const html = renderPaymentDueEmail({ ...base, deadline });
    expect(html).toContain("R$ 100,00");
    expect(html).toContain("23/10");
    expect(html).toContain("Pagar agora");
    expect(html).toContain("&lt;b&gt;"); // a forma ESCAPADA é o que sai
    expect(html).not.toContain("<b>raro</b>");
  });

  it("payment_confirmed: congratula com valor e link do comprovante", () => {
    const html = renderPaymentConfirmedEmail(base);
    expect(html).toContain("Parabéns");
    expect(html).toContain("R$ 100,00");
    expect(html).toContain("Ver comprovante");
    expect(html).toContain(encodeURIComponent("").length === 0 ? "payments/p1" : "payments/p1");
  });

  it("payment_expired: informa encerramento e escapa o título", () => {
    const html = renderPaymentExpiredEmail(base);
    expect(html).toContain("venceu");
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>raro</b>");
  });

  it("next_bidder_called: 'você está na sequência' com prazo e valor", () => {
    const html = renderNextBidderCalledEmail({ ...base, deadline });
    expect(html).toContain("Você está na sequência");
    expect(html).toContain("R$ 100,00");
    expect(html).toContain("Pagar o arremate");
  });

  it("todos escapam o nome do arrematante", () => {
    const evil = { ...base, bidderName: 'Ana"<script>' };
    expect(renderPaymentDueEmail({ ...evil, deadline })).not.toContain("<script>");
    expect(renderPaymentConfirmedEmail(evil)).not.toContain("<script>");
    expect(renderPaymentExpiredEmail(evil)).not.toContain("<script>");
    expect(renderNextBidderCalledEmail({ ...evil, deadline })).not.toContain("<script>");
  });
});
