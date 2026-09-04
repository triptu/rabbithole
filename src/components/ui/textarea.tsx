import type * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "box-border w-full resize-none rounded-xl border border-line bg-paper p-4 text-[13.5px] leading-[1.6] text-ink placeholder:text-faint focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
