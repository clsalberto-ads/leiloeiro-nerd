"use client";

import * as React from "react";
import { cn } from "cn";
import { Dialog } from "@base-ui/react/dialog";

const Sheet = Dialog.Root;
const SheetTrigger = Dialog.Trigger;
const SheetClose = Dialog.Close;

function SheetContent({
  className,
  side = "left",
  children,
  ...props
}: React.ComponentProps<typeof Dialog.Popup> & { side?: "left" | "right" | "top" | "bottom" }) {
  return (
    <Dialog.Portal>
      <Dialog.Viewport className={cn(
        "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        {
          "left-0 top-0 h-full w-3/4 max-w-sm": side === "left",
          "right-0 top-0 h-full w-3/4 max-w-sm": side === "right",
          "left-0 bottom-0 w-full h-3/4 max-h-sm": side === "bottom",
          "left-0 top-0 w-full h-3/4 max-h-sm": side === "top",
        },
        className
      )}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Popup
          className={cn(
            "z-50 flex flex-col gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
            {
              "left-0 top-0 h-full w-3/4 max-w-sm": side === "left",
              "right-0 top-0 h-full w-3/4 max-w-sm": side === "right",
              "left-0 bottom-0 w-full h-3/4 max-h-sm": side === "bottom",
              "left-0 top-0 w-full h-3/4 max-h-sm": side === "top",
            },
            className
          )}
        >
          {children}
          <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </SheetClose>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}

const SheetHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<"h2">>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
  )
);
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
SheetDescription.displayName = "SheetDescription";

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
