import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium select-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        brand:
          "bg-gradient-to-r from-[var(--brand)] to-[var(--brand)]/85 text-white border border-[var(--brand)]/30 shadow-lg hover:shadow-xl hover:from-[var(--brand)]/90 hover:to-[var(--brand)]/75 focus-visible:ring-[var(--brand)]/30",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80 border border-border shadow-sm",
        outline:
          "bg-transparent text-[var(--brand)] border border-[var(--brand)]/50 hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] shadow-sm",
        ghost: "bg-transparent text-foreground hover:bg-[var(--brand)]/10 hover:text-[var(--brand)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
        glass:
          "bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 text-foreground shadow-xl hover:from-white/25 hover:to-white/10 hover:shadow-2xl",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-10 w-10 p-0",
      },
      radius: {
        md: "rounded-xl",
        lg: "rounded-2xl",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "brand",
      size: "md",
      radius: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, radius }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

