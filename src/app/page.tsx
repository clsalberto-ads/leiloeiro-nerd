import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldCheck, Sparkles, TrendingUp, Users, ArrowRight, Gavel, Award, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Gavel className="h-5 w-5" />
          </span>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Leiloeiro Nerd
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="#features" className="transition-colors hover:text-foreground">Recursos</Link>
          <Link href="#benefits" className="transition-colors hover:text-foreground">Vantagens</Link>
          <Link href="#stats" className="transition-colors hover:text-foreground">Plataforma</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button render={<Link href="/login">Entrar</Link>} variant="ghost" size="sm" />
          <Button render={<Link href="/register">Criar conta</Link>} size="sm" className="gap-1.5 shadow-sm" />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32 lg:py-40">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="container relative mx-auto px-6 text-center">
            <div className="mx-auto max-w-3xl space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur animate-fade-in">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Taxa Zero para Lances e Leilões</span>
              </div>
              
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                Onde Colecionadores e Entusiastas <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Encontram Tesouros</span>
              </h1>
              
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
                A plataforma de leilões moderna com curadoria especializada, máxima segurança e zero taxas. Exponha suas peças ou arremate itens exclusivos.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button 
                  render={<Link href="/register">Começar Agora <ArrowRight className="h-4 w-4 ml-1" /></Link>} 
                  size="lg" 
                  className="w-full sm:w-auto h-12 px-8 text-base shadow-md" 
                />
                <Button 
                  render={<Link href="/login">Explorar Plataforma</Link>} 
                  variant="outline" 
                  size="lg" 
                  className="w-full sm:w-auto h-12 px-8 text-base" 
                />
              </div>

              {/* Quick Trust Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-12 border-t mt-16 max-w-2xl mx-auto text-center">
                <div>
                  <div className="text-2xl font-bold">100%</div>
                  <div className="text-xs text-muted-foreground mt-1">Seguro e Verificado</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">R$ 0</div>
                  <div className="text-xs text-muted-foreground mt-1">Taxas de Comissão</div>
                </div>
                <div>
                  <div className="text-2xl font-bold col-span-2 md:col-span-1">24/7</div>
                  <div className="text-xs text-muted-foreground mt-1">Suporte Especializado</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features / Benefits Section */}
        <section id="features" className="py-24 bg-muted/30 border-y">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Por que escolher o Leiloeiro Nerd?</h2>
              <p className="text-muted-foreground text-lg">Desenvolvido pensando na melhor experiência de leilão digital, unindo segurança e facilidade.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="flex flex-col items-start p-8 rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md">
                <div className="p-3 rounded-xl bg-primary/10 text-primary mb-6">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Segurança Total</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Transações protegidas e verificação rigorosa de usuários para garantir que você compre e venda com tranquilidade absoluta.
                </p>
              </div>

              <div className="flex flex-col items-start p-8 rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md">
                <div className="p-3 rounded-xl bg-primary/10 text-primary mb-6">
                  <Award className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Curadoria Especializada</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Itens raros, colecionáveis autênticos e serviços geeks selecionados por especialistas da comunidade.
                </p>
              </div>

              <div className="flex flex-col items-start p-8 rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md">
                <div className="p-3 rounded-xl bg-primary/10 text-primary mb-6">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Taxa Zero</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Diferente de plataformas tradicionais, aqui você não paga comissão sobre seus lances ou itens vendidos. O lucro é 100% seu.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="rounded-3xl border bg-card p-12 md:p-16 text-center relative overflow-hidden shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Pronto para encontrar seu próximo tesouro?</h2>
                <p className="text-muted-foreground text-lg">Junte-se a centenas de colecionadores e comece a dar lances ou criar seus próprios leilões hoje mesmo.</p>
                <div className="pt-2">
                  <Button render={<Link href="/register">Criar Conta Gratuita</Link>} size="lg" className="h-12 px-8 text-base shadow-md" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-12 px-6 text-center text-sm text-muted-foreground">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <Gavel className="h-4 w-4" />
            <span>Leiloeiro Nerd</span>
          </div>
          <p>© {new Date().getFullYear()} Leiloeiro Nerd. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">Termos</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}