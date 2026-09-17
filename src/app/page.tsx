import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Leiloeiro Nerd</h1>
        <p className="text-lg text-muted-foreground">
          A plataforma de leilões para você expor suas peças e serviços ou arrematar
          itens de colecionadores.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button render={<a href="/login">Entrar</a>} />
        <Button render={<a href="/register">Criar conta</a>} variant="outline" />
      </div>
    </main>
  );
}