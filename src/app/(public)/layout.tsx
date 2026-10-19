import { AppHeader } from "@/components/layout/app-header";
import { getSession } from "@/presentation/actions/auth-actions";

// ponytail: o layout é quem lê a sessão e desce o nome ao header — o mesmo
// desenho do `(dashboard)/layout.tsx`. Ler `headers()` aqui torna as rotas
// públicas dinâmicas (a home era estática): é o preço necessário de um header
// que muda com quem está logado, e todas as demais páginas públicas
// (vitrine, detalhe, explore) já eram dinâmicas.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader userName={session?.user.name ?? null} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
