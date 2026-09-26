import { ROTULO_STATUS, type ItemStatus } from "@/domain/repositories/item-repository";
import { Badge } from "@/components/ui/badge";

// ponytail: o TEXTO do badge nao mora aqui — e `ROTULO_STATUS`, no dominio, e o
// mesmo texto que a coluna da tabela, que a aba e que a busca server-side casam.
// A decisao de o rotulo ser do dominio esta escrita la. O que sobra deste lado e a
// COR, e e a unica coisa aqui que o dominio nao tem por que saber: `emerald-100`
// nao nomeia um status, ele decora um. `CLASSES` e `Record<ItemStatus, string>`
// exaustivo pelo mesmo motivo do mapa la — um status novo sem cor aqui e um status
// novo sem rotulo ali, e os dois aparecem no mesmo `tsc`.
const CLASSES: Record<ItemStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-800",
  closed: "bg-sky-100 text-sky-800",
  awaiting_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-destructive/10 text-destructive",
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <Badge className={CLASSES[status]}>{ROTULO_STATUS[status]}</Badge>;
}
