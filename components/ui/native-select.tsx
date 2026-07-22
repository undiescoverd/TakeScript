import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Styled native <select>. Used instead of the Radix Select where the listbox
 * must survive hostile hosts — e.g. inside Clerk's account modal, whose focus
 * management closes portaled Radix popovers (clerk/javascript#4308). The
 * browser renders the native popup at OS level, immune to z-index stacking
 * and focus traps. The onFocus guard is the documented Clerk workaround.
 */
function NativeSelect({ className, onFocus, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input dark:bg-input/30 h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        className
      )}
      onFocus={(e) => {
        // Clerk's modal focus handler otherwise swallows the select
        e.stopPropagation();
        onFocus?.(e);
      }}
      {...props}
    />
  );
}

export { NativeSelect };
