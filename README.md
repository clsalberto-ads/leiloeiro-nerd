# Leiloeiro Nerd

Plataforma web de leilões onde leiloeiros expõem peças, produtos e serviços, e
arrematantes dão lances. Este repositório contém a base técnica do projeto
(Next.js 16, PostgreSQL, Redis, Better Auth, Drizzle ORM).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Linguagem | TypeScript (strict) |
| Estilização | Tailwind CSS v4 + shadcn/ui |
| Banco | PostgreSQL 17 (Docker) |
| ORM | Drizzle ORM |
| Autenticação | Better Auth |
| Fila / Cron | Redis 7 + BullMQ |
| Testes | Vitest |
| Package manager | pnpm |

## Requisitos

- Node.js >= 20.9.0 (recomendado: 24 LTS — ver `.nvmrc`)
- pnpm
- Docker + Docker Compose

## Início rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# gere um secret: openssl rand -hex 32, e coloque em BETTER_AUTH_SECRET

# 3. Subir infraestrutura (PostgreSQL + Redis)
docker compose up -d

# 4. Aplicar migrações do banco
pnpm db:migrate
```

## Scripts

| Script | Descrição |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm start` | Sobe o build de produção |
| `pnpm lint` | ESLint |
| `pnpm test` | Executa os testes (Vitest) |
| `pnpm typecheck` | Checagem de tipos (tsc --noEmit) |
| `pnpm db:generate` | Gera migrações a partir do schema Drizzle |
| `pnpm db:migrate` | Aplica migrações no banco |
| `pnpm db:push` | Push direto do schema (dev) |
| `pnpm auth:generate` | Regenera o `auth-schema.ts` do Better Auth |
| `pnpm worker` | Sobe o worker BullMQ (espelha fila `auction-jobs`) |

## Arquitetura

Clean Architecture pragmática em camadas:

- `src/domain/` — value objects e contratos de repositório (regras puras)
- `src/application/` — use cases (funções com dependências injetadas)
- `src/infrastructure/` — implementações concretas (Drizzle, Better Auth, filas)
- `src/app/` e `src/presentation/actions/` — camada de apresentação (rotas e server actions)

## Funcionalidades atuais

- Autenticação: registro, login e recuperação de senha (Better Auth)
- Dashboard protegido com proxy de guard
- Atualização de perfil (nome, slug, telefone, endereço) via use case + repositório
- Worker BullMQ conectado ao Redis (placeholder)
- Schema Drizzle completo: `user`, `items`, `bids`, `payments`, `notifications`

## Autenticação

As rotas de auth ficam em `/api/auth/*` (handler do Better Auth). A verificação
de e-mail não é ativada nesta fase; o link de redefinição de senha é logado no
console pela implementação placeholder de `emailSender`.