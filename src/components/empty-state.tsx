import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// ponytail: a acao tem DUAS formas e a divisao nao e de estilo, e de quem pode
// executa-la. `href` e um link de verdade, e o que cabe num componente servidor
// (a vitrine publica, que nao tem callback nenhum). `onSelect` e um botao, e
// existe porque quem esta DENTRO da tabela ja tem a propria navegacao em maos: no
// modo servidor a lista de itens manda `navegar(vista)` e nao uma URL escrita a
// mao (veja a nota no `items-list.tsx`), e um link apontando para
// `/dashboard/items` seria uma segunda forma de escrever a mesma URL — que e
// exatamente como as duas passam a divergir quando o `hrefDaVista` muda. A union
// (e nao dois props opcionais) e o que impede a acao pela metade: `{ label }`
// sem `href` nem `onSelect` nao compila, em vez de virar um botao que nao faz
// nada.
export type EmptyStateAction = { label: string; href: string } | { label: string; onSelect: () => void };

interface EmptyStateProps {
  title: string;
  // ponytail: `description` e OPCIONAL, e a unica assinatura que muda em relacao ao
  // desenho do plano. O motivo e o `DataTable`: ele ja tem `emptyMessage`, uma
  // string so, e e o contrato que a lista de itens consome desde a Task 8. Se
  // `description` fosse obrigatoria, a celula da tabela teria de receber uma
  // segunda string (`emptyDescription`) so para preencher um campo que o
  // consumidor nunca pediu — ou entao repetiria a frase do titulo dentro da
  // descricao. Com ela opcional, `emptyMessage` vira `title` e nao nasce prop
  // nova de texto.
  description?: string;
  action?: EmptyStateAction;
  icon?: ReactNode;
}

// ponytail: o `data-slot="empty-state"` e o que impede a segunda fonte de
// verdade. A celula vazia da `DataTable` e a vitrine sao o mesmo estado vazio com
// formatos diferentes de hospedagem (uma `td`, um `div`), e a tentacao natural
// quando os dois precisam de icone e acao e reescrever o cartao na tabela. Com o
// marcador, o teste da tabela afirma que ela compoe ESTE componente, e um
// conserto so num dos dois para de passar.
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      {icon}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        "href" in action ? (
          <Link href={action.href} className="text-sm font-medium text-primary underline">
            {action.label}
          </Link>
        ) : (
          // ponytail: o `underline` fixo e o que faz as duas formas da acao
          // parecerem a mesma acao. O `variant="link"` sozinho sublinha so no
          // `hover`, e um botao que so sublinha ao passar o mouse nao parece um
          // link ao lado de um que ja esta sublinhado.
          <Button type="button" variant="link" size="sm" onClick={action.onSelect} className="underline">
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
