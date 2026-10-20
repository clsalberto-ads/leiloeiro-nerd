import { cn } from "cn";

// ponytail: A largura da página deixou de ser decisão de cada arquivo. O
// layout do dashboard fornece o shell (sidebar + header + <main>); cada
// página escolhe UM destes três tamanhos — e nenhum outro:
//   "wide"    (6xl)  — listas: tabela de itens, notificações, lances, favoritos
//   "default" (5xl)  — páginas mistas: painel, configurações, formulários
//   "content" (3xl)  — leitura focada: pagamento (QR + cópia de código)
export type PageContainerSize = "wide" | "default" | "content";

const SIZE_MAX_WIDTH: Record<PageContainerSize, string> = {
  wide: "max-w-6xl",
  default: "max-w-5xl",
  content: "max-w-3xl",
};

export function PageContainer({
  children,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: PageContainerSize;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 px-4 sm:px-6 lg:px-8",
        SIZE_MAX_WIDTH[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
