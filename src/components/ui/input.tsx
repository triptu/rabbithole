import type * as React from "react";

import { cn } from "@/lib/utils";

/** White field with a hairline that turns accent on focus. */
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "box-border w-full rounded-[10px] border border-line bg-paper px-3.5 py-[9px] text-[12.5px] text-ink placeholder:text-faint focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}

/** Borderless field for pill-shaped composers (focus on…, follow-ups, explain…). */
export function BareInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="bare-input"
      className={cn("min-w-0 flex-1 border-none bg-transparent py-1.5 text-[12px] text-ink placeholder:text-faint", className)}
      {...props}
    />
  );
}
