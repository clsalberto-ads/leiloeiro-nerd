"use client";

import Link from "next/link";
import { cn } from "cn";

interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
  className?: string;
  children: React.ReactNode;
}

export function LinkButton({
  href,
  variant = "ghost",
  size = "default",
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-primary text-primary-foreground hover:bg-primary/80": variant === "default",
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground": variant === "outline",
          "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
          "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
          "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
          "text-primary underline-offset-4 hover:underline": variant === "link",
        },
        {
          "h-10 px-4 py-2": size === "default",
          "h-9 rounded-md px-3": size === "sm",
          "h-11 rounded-md px-8": size === "lg",
          "h-10 w-10": size === "icon",
        },
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
