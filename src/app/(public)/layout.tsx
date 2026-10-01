import { AppHeader } from "@/components/layout/app-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
