"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DIAS_POR_PERIODO, hrefDoPeriodo, nomeDoPeriodo, type ChavePeriodo } from "../periodo/periodo";

// ponytail: este e um `<Button>` por janela e nao um `<Select>`, mesmo com o
// `select.tsx` instalado no projeto. Sao tres opcoes, e um grupo de botoes
// deixa as tres JANELAS visiveis ao mesmo tempo — o que importa aqui, porque a
// escolha e "quanto tempo eu quero enxergar", e esconder as opcoes atras de um
// popup esconde justamente o que o usuario precisa comparar para escolher. A
// troca de periodo e um `router.push` de uma URL que o servidor ja sabe ler, o
// mesmo mecanismo de "URL como estado" da lista de itens. O `router.push` do App
// Router ja e nao urgente por conta propria, entao nao ha `startTransition`
// por fora: envolver de novo nao mudaria nada.
export function PeriodoSelect({ atual }: { atual: ChavePeriodo }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Período da análise">
      {(Object.keys(DIAS_POR_PERIODO) as ChavePeriodo[]).map((chave) => {
        const ativo = chave === atual;
        return (
          <Button
            key={chave}
            size="sm"
            variant={ativo ? "default" : "outline"}
            aria-pressed={ativo}
            onClick={() => router.push(hrefDoPeriodo(chave))}
          >
            {nomeDoPeriodo(chave)}
          </Button>
        );
      })}
    </div>
  );
}
