import { Button } from "@/components/ui/button";
import {
  connectPagBankAction,
  disconnectPagBankAction,
} from "@/presentation/actions/pagbank-actions";

// ponytail: seção da conta PagBank do LEILOEIRO. A página (server) busca a
// conta SEM token (`findByUserId` da porta segura) e desce só o estado; os
// forms são um componente separado porque levam as actions de conectar
// (redirect externo) e desconectar — e porque o teste de DOM renderiza o
// estado sem puxar o repositório junto.
export function PagBankAccountSection({
  account,
  flash,
}: {
  account: { connectedAt: Date; accountId: string | null } | null;
  flash?: string;
}) {
  const connected = account !== null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Conta PagBank</h2>
      <p className="text-sm text-muted-foreground">
        Conecte sua conta para receber o pagamento dos arremates. A plataforma retém 5% de taxa de
        intermediação; o restante cai direto na sua conta.
      </p>

      {flash ? <FlashMessage flash={flash} /> : null}

      {connected ? (
        <div className="space-y-2">
          <p className="text-sm">
            ✅ Conectada
            {account.accountId ? ` (conta PagBank ${account.accountId})` : ""} desde{" "}
            {account.connectedAt.toLocaleDateString("pt-BR", { dateStyle: "long" })}.
          </p>
          <form action={disconnectPagBankAction}>
            <Button type="submit" variant="outline" size="sm">
              Desconectar conta
            </Button>
          </form>
        </div>
      ) : (
        <form action={connectPagBankAction}>
          <Button type="submit">Conectar conta PagBank</Button>
        </form>
      )}
    </section>
  );
}

// ponytail: o `?pagbank=` volta do CALLBACK do OAuth e dos erros do
// connectAction. Cada valor é um resultado que o vendedor pode entender sem
// abrir o console — o mapa é fechado de propósito: valor desconhecido é
// tratado como nada (não vaza query string para a tela).
const FLASH_LABELS: Record<string, string> = {
  conectado: "Conta PagBank conectada com sucesso!",
  "erro-autorizacao": "A autorização foi negada no PagBank. Tente conectar novamente.",
  "erro-callback": "O retorno do PagBank veio incompleto. Tente conectar novamente.",
  "erro-sessao": "Sua sessão expirou durante a conexão. Entre de novo e tente outra vez.",
  "erro-state": "A validação de segurança da conexão falhou. Tente conectar novamente.",
  "erro-troca": "O PagBank recusou a conexão. Aguarde um instante e tente de novo.",
};

function FlashMessage({ flash }: { flash: string }) {
  const label = FLASH_LABELS[flash];
  if (!label) return null;
  const ok = flash === "conectado";
  return (
    <p role="status" className={ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
      {label}
    </p>
  );
}
