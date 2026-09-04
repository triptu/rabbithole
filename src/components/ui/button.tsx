import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The handful of button shapes the design uses. Nothing generic here: each variant
 * is one of the export's recurring buttons.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** dark, turns accent on hover — "make it readable", "Elaborate", "Save" */
        primary: "rounded-lg bg-ink text-white hover:bg-accent",
        /** hairline box — "+ new", sort toggle */
        outline: "rounded-lg border border-line bg-transparent text-slate hover:border-accent hover:text-accent",
        /** white pill — suggestions */
        pill: "gap-1 rounded-full border border-line bg-paper font-normal text-ink-3 hover:border-accent hover:text-accent",
        /** toggleable pill — preference chips, "bookmarked" filter */
        chip: "rounded-full border border-line bg-paper text-faint data-[on=true]:border-accent data-[on=true]:bg-accent-soft data-[on=true]:text-accent",
        /** dashed pill — "+ set goal" */
        dashed: "rounded-full border border-dashed border-line-2 bg-transparent font-normal text-muted hover:border-accent hover:text-accent",
        /** bare text/icon — ×, ↵, bookmark */
        ghost: "rounded-md bg-transparent font-normal text-faint hover:text-accent",
        /** top bar nav — "History" */
        nav: "rounded-lg bg-transparent text-slate hover:bg-panel data-[on=true]:bg-panel data-[on=true]:text-ink",
      },
      /* each size is one recurring spec from the export: padding / font-size */
      size: {
        /** 4px 8px · 12px — the ↵ send buttons */
        xs: "px-2 py-1 text-[12px]",
        /** 7px 14px · 11.5px — Elaborate, mock agent */
        sm: "px-3.5 py-[7px] text-[11.5px]",
        /** 6px 12px · 12px — "+ new", History */
        nav: "px-3 py-1.5 text-[12px]",
        /** 8px 14px · 12px — filter / sort / preference chips */
        md: "px-3.5 py-2 text-[12px]",
        /** 10px 18px · 12.5px — make it readable, Save */
        lg: "px-[18px] py-2.5 text-[12.5px]",
        /** 8px 16px · 12.5px — suggestion pills */
        pill: "px-4 py-2 text-[12.5px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** for `chip` / `nav` variants */
  on?: boolean;
}

export function Button({ className, variant, size, asChild = false, on, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      data-on={on === undefined ? undefined : String(on)}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
