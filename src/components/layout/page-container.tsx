import { cn } from "cn";

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}