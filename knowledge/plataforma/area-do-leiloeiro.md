# Área do leiloeiro

A área protegida permite criar, editar, publicar, cancelar e excluir itens, conforme permissões e validações da aplicação. O formulário contempla título, descrição, tipo, valor mínimo inicial, incremento mínimo, prazo de encerramento, prazo de pagamento em dias e imagens.

Tipos de item: Produto (`product`), Serviço (`service`) e Peça colecionável (`piece`). O projeto usa UploadThing para imagens.

Estados conhecidos: `draft` (Rascunho), `active` (Em leilão), `closed` (Encerrado), `awaiting_payment` (Aguardando pagamento), `paid` (Pago), `cancelled` (Cancelado). Não confirme o estado atual sem consultar o sistema.
