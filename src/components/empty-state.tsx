import type { ReactNode } from "react";
import Link from "next/link";

// ponytail: a acao e SEMPRE um link, e nao um botao com callback, porque o que o
// cartao oferece aqui e navegacao — e um link entrega as afinidades que um
// `<button onClick>` nao tem: abrir em nova aba, clique do meio, ctrl-clique,
// copiar endereco, a URL na barra de status e o rastreamento. Um estado vazio
// com acao e, na pratica, sempre "voltar para uma URL", e essa URL existe antes
// de qualquer clique: quem monta o cartao a le de algum lugar e a escreve no
// `href`.
//
// Um `onSelect` como segunda forma da acao custaria o preco disso para nao
// ganhar nada: a acao de quem esta dentro da tabela (`navegar(vista)`) e
// equivalente, e ela nao e uma segunda fonte da URL — o `buildStorefrontHref` vira
// string num lugar so, e o `buildStorefrontHref(vistaSemFiltro(vista))` nao e uma segunda
// copia do endereco, e o mesmo contrato de URL chamado com outra vista.
export type EmptyStateAction = { label: string; href: string };

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
        // ponytail: o `underline` fixo e o que faz a acao parecer o que e. Com
        // `hover:underline` o rotulo so se denuncia como link quando o mouse passa
        // por cima, e um link que so parece link ao passar por cima e pior que um
        // botao: promete a affordance sem entregar a pista visual.
        <Link href={action.href} className="text-sm font-medium text-primary underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
