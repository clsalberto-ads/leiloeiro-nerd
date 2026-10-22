# Pagamentos: estado conhecido da implementação

O repositório contém base de repositório de pagamentos com referência a PIX e link de pagamento. Existe restrição única em `mp_payment_id`, descrita como proteção de idempotência do webhook.

Essas estruturas não comprovam que todo o fluxo esteja operacional em produção nem que uma transação específica tenha sido processada. O item possui `paymentDeadlineDays`; não assuma prazo universal.

Oriente a consultar anúncio e edital. Não invente taxas, comissões, multas, descontos, cauções ou consequências por atraso. Não confirme pagamento sem consulta autenticada ao sistema.
