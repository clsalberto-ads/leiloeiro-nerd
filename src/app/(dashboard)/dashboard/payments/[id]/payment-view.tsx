"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { BidCountdown } from "@/components/bid-countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelPaymentFormAction, getPaymentStatusAction } from "@/presentation/actions/payment-actions";
import { formatBRL } from "@/lib/format-brl";

type PaymentStatus = "pending" | "approved" | "expired" | "cancelled" | "refunded";

// ponytail: os rótulos e cores do status de pagamento. Mapa FECHADO, exaustivo
// pela mesma regra do STATUS_LABELS do domínio — status novo sem linha aqui é
// erro de compilação, não um badge vazio na tela.
const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Aguardando pagamento",
  approved: "Pago",
  expired: "Expirado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const STATUS_CLASSES: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-sky-100 text-sky-800",
};

export interface PaymentViewProps {
  paymentId: string;
  initialStatus: PaymentStatus;
  amountCents: number;
  qrCode: string | null;
  pixCopiaECola: string | null;
  paymentLink: string | null;
  deadline: string;
}

const POLL_MS = 10_000;

// ponytail: `.bind(null, null)` transforma `(prev, formData)` em
// `(formData)` — a assinatura que o `<form action>` aceita. O mesmo
// arranjo das ações de publicar/cancelar item no `columns.tsx`.
const cancelFormAction = cancelPaymentFormAction.bind(null, null);

export function PaymentView(props: PaymentViewProps) {
  const [status, setStatus] = useState<PaymentStatus>(props.initialStatus);

  // ponytail: o polling lê o estado LOCAL (a action não toca na MP — o motivo
  // está documentado nela) e PARA quando o pagamento sai de `pending`. Os
  // mesmos cuidados do poll da vitrine: `document.hidden` não acorda o
  // servidor com aba de fundo, e o `.catch` evita unhandled rejection.
  useEffect(() => {
    if (status !== "pending") return;
    const id = setInterval(() => {
      if (document.hidden) return;
      startTransition(() => {
        void getPaymentStatusAction(props.paymentId)
          .then((res) => {
            if (res.status) setStatus(res.status as PaymentStatus);
          })
          .catch(() => {});
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [status, props.paymentId]);

  const copyPix = useCallback(async () => {
    if (!props.pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(props.pixCopiaECola);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  }, [props.pixCopiaECola]);

  const pending = status === "pending";
  const deadline = new Date(props.deadline);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          Valor do arremate: <span className="text-primary">R$ {formatBRL(props.amountCents)}</span>
        </CardTitle>
        <Badge className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {pending ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Pague até <BidCountdown deadline={deadline} />
              </p>
              {props.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={props.qrCode}
                  alt="QR Code PIX para pagamento do arremate"
                  className="h-64 w-64 rounded-lg border p-2"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  O QR Code não está disponível — use o código copia-e-cola abaixo.
                </p>
              )}
            </div>

            {props.pixCopiaECola ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">PIX copia-e-cola</p>
                <div className="flex items-start gap-2">
                  <code className="max-h-32 flex-1 overflow-y-auto break-all rounded-lg border bg-muted p-3 text-xs">
                    {props.pixCopiaECola}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={copyPix}>
                    <CopyIcon data-icon="inline-start" aria-hidden="true" />
                    Copiar
                  </Button>
                </div>
              </div>
            ) : null}

            {props.paymentLink ? (
              <Button
                nativeButton={false}
                render={<a href={props.paymentLink} target="_blank" rel="noopener noreferrer" />}
                variant="outline"
              >
                <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
                Abrir link de pagamento
              </Button>
            ) : null}

            <form action={cancelFormAction} className="pt-2">
              <input type="hidden" name="paymentId" value={props.paymentId} />
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                Cancelar pagamento
              </Button>
            </form>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <CheckIcon aria-hidden="true" className="mt-0.5 size-4 text-emerald-600" />
            <p>
              {status === "approved" && "Pagamento confirmado! O vendedor será notificado do recebimento."}
              {status === "expired" && "O prazo deste pagamento venceu. Aguarde o contato sobre os próximos passos."}
              {status === "cancelled" && "Você cancelou este pagamento."}
              {status === "refunded" && "Este pagamento foi reembolsado."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
