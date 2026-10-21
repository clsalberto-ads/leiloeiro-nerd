# Mercado Pago MCP Server — Configuração

O MCP do Mercado Pago é um **servidor remoto** que dá ao seu IDE acesso
direto à documentação e ferramentas da API do Mercado Pago via IA.

## URL do servidor

```
https://mcp.mercadopago.com/mcp
```

## Configuração no Zed (já configurado)

O `~/.config/zed/settings.json` já tem o `context_servers.mercadopago`:

```json
{
  "context_servers": {
    "mercadopago": {
      "source": "remote",
      "url": "https://mcp.mercadopago.com/mcp"
    }
  }
}
```

### Para ativar:

1. **Reinicie o Zed** (ou recarregue as configurações)
2. Abra o **Agent Panel** (Ctrl+Shift+A ou Cmd+Shift+A)
3. Nas configurações do agente, o servidor `mercadopago` deve aparecer
4. Ao usar pela primeira vez, o Zed pedirá **autorização OAuth** — você é
   redirecionado para o site do Mercado Pago, seleciona **Brasil**,
   clica **Autorizar** e volta ao Zed
5. Pronto — o assistente do Zed agora tem acesso às tools da MP

## Configuração em outros clientes

### VS Code
```
Ctrl+Shift+P → "MCP: Add Server" → HTTP → mercadopago → https://mcp.mercadopago.com/mcp
```

### Claude Code
```bash
claude mcp add mercadopago --transport http https://mcp.mercadopago.com/mcp
```

### Cursor
Adicione ao `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "mercadopago-mcp-server": {
      "url": "https://mcp.mercadopago.com/mcp"
    }
  }
}
```

## Tools disponíveis após conectar

| Tool | O que faz |
|------|-----------|
| `search-documentation` | Busca na documentação oficial da MP |
| `create-payment-preference` | Cria uma preferência de Checkout Pro |
| `get-payment-status` | Consulta o status de um pagamento |
| `create-payment` | Cria um pagamento via API |
| `get-credential` | Consulta credenciais |

## Testar a conexão

No assistente do Zed, pergunte:

```
Busque na documentação do Mercado Pago como integrar o Checkout Pro.
```

Se a resposta vier com conteúdo da documentação oficial, a conexão funciona.

## Fonte

[Documentação oficial](https://www.mercadopago.com.br/developers/pt/docs/mcp-server/connection)
