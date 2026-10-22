# Escopo do assistente virtual

O assistente responde em português do Brasil, de forma clara e objetiva, dúvidas documentadas sobre a plataforma. A rota `/api/chat` valida mensagens, limita o histórico às últimas 20 mensagens e cada mensagem a 2.000 caracteres. Gera embedding com Gemini, busca trechos no índice local e envia contexto ao modelo via OpenRouter.

A busca usa apenas a última mensagem do usuário; perguntas curtas de acompanhamento podem não recuperar o assunto anterior. Reformule incluindo o tema.

Não invente taxas, prazos, políticas ou funcionalidades. Se não houver evidência suficiente, diga que não encontrou informação confirmada. O RAG não consulta automaticamente dados atuais de itens, lances ou pagamentos e não executa lances, cancelamentos ou pagamentos. A resposta depende de `OPENROUTER_API_KEY`; embeddings dependem de `GEMINI_API_KEY`. Após alterar os Markdown, execute `pnpm knowledge:index`.
