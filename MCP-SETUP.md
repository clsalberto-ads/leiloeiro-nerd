# Mercado Pago MCP Server — Configuração

O MCP do Mercado Pago é um **servidor remoto** que dá ao seu IDE acesso
direto à documentação e ferramentas da API do Mercado Pago via IA.

## URL do servidor

```
https://mcp.mercadopago.com/mcp
```

## Configuração por cliente

### Cursor
1. O arquivo `.cursor/mcp.json` já está criado neste repositório
2. Abra o Cursor → **Settings → Tools & MCPs**
3. Clique **"Connect"** ao lado de `mercadopago-mcp-server`
4. Você será redirecionado para o site do Mercado Pago
5. Selecione o **país** (Brasil) e **autorize** a conexão
6. Volte ao Cursor — a conexão estará ativa

### VS Code
1. Abra a paleta de comandos (Ctrl+Shift+P)
2. Digite "MCP: Add Server" e selecione
3. Escolha "HTTP"
4. Nome: `mercadopago`
5. URL: `https://mcp.mercadopago.com/mcp`
6. Autorize quando solicitado

### Claude Code
```bash
claude mcp add mercadopago --transport http https://mcp.mercadopago.com/mcp
```

## Tools disponíveis

Após conectar, o seu assistente de IA pode:

| Tool | O que faz |
|------|-----------|
| `search-documentation` | Busca na documentação oficial da MP |
| `create-payment-preference` | Cria uma preferência de Checkout Pro |
| `get-payment-status` | Consulta o status de um pagamento |
| `create-payment` | Cria um pagamento via API |
| `get-credential` | Consulta credenciais |

## Testar a conexão

No seu IDE, pergunte ao assistente:

```
Busque na documentação do Mercado Pago como integrar o Checkout Pro.
```

Se a resposta vier com conteúdo da documentação oficial, a conexão funciona.

## Fonte

[Documentação oficial](https://www.mercadopago.com.br/developers/pt/docs/mcp-server/connection)
