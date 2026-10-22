# Funcionamento dos lances

O código valida estado do item, prazo de encerramento, valor mínimo inicial, incremento mínimo e relação entre item e leiloeiro responsável. O valor mínimo e o incremento são definidos por item.

A página pública exibe histórico de lances e consulta atualizações periodicamente; a documentação técnica indica polling de aproximadamente 10 segundos. O projeto implementa notificação de lance superado dentro do site e por e-mail via Resend.

O RAG não contém lances atuais. Não afirme maior lance, líder, quantidade de lances ou aceitação de lance específico sem consultar dados atuais. Não prometa que o participante pode cancelar um lance confirmado nem invente exceções.
