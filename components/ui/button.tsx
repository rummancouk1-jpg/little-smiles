import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out focus-visible:outline-none active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 dark:aria-invalid:border-destructive/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.06)] hover:bg-primary/92 active:bg-primary/[0.97] [a]:hover:bg-primary/92 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        outline:
          "border-[#3B2F2F]/26 bg-white/92 text-[#2E2323] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:border-[#3B2F2F]/40 hover:bg-[#F2EAE4] hover:text-[#1F1918] active:bg-[#E8DFD6] active:border-[#3B2F2F]/44 aria-expanded:border-[#3B2F2F]/36 aria-expanded:bg-[#F2EAE4] aria-expanded:text-[#1F1918] dark:border-input dark:bg-input/35 dark:text-foreground dark:hover:bg-input/55 dark:hover:text-foreground focus-visible:border-[#3B2F2F]/42 focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        secondary:
          "border border-[#3B2F2F]/18 bg-[#F2EAE4]/98 text-[#2E2323] hover:border-[#3B2F2F]/28 hover:bg-[#EBE3DC] hover:text-[#1F1918] active:bg-[#E3D9D0] active:border-[#3B2F2F]/32 dark:border-white/12 dark:bg-muted dark:text-foreground dark:hover:bg-muted/85 focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/28 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ghost:
          "text-[#2E2323] hover:bg-[#3B2F2F]/12 hover:text-[#1F1918] active:bg-[#3B2F2F]/17 aria-expanded:bg-[#3B2F2F]/10 dark:text-foreground dark:hover:bg-muted/60 dark:hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/28 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        destructive:
          "bg-destructive/12 text-destructive hover:bg-destructive/20 hover:text-destructive active:bg-destructive/25 focus-visible:ring-2 focus-visible:ring-destructive/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:text-[#1F1918] hover:underline focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/28 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
