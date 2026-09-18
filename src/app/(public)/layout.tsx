import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b px-4 py-3">
        <Link href="/" className="text-xl font-bold">Leiloeiro Nerd</Link>
      </header>
      <main className="container mx-auto py-8 px-4">{children}</main>
    </>
  );
}