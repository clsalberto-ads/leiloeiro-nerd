"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/presentation/actions/auth-actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardSidebarMobile } from "@/components/layout/dashboard-sidebar";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function DashboardHeader({ userName }: { userName?: string | null }) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          render={(props) => (
            <Button {...props} variant="ghost" size="icon" className="sm:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          )}
        />
        <SheetContent side="left">
          <DashboardSidebarMobile onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-end border-b bg-background/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />
          <ThemeToggle />
          {userName ? <span className="hidden text-sm text-muted-foreground sm:inline-block">Olá, {userName}</span> : null}
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">Sair</Button>
          </form>
        </div>
      </header>
    </>
  );
}
