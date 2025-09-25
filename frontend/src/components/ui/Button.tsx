import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        brand:
          "bg-brand text-brand-foreground hover:bg-brand-hover shadow-xl hover:shadow-2xl",
        secondary:
          "bg-muted text-foreground hover:bg-accent/30 border border-border/50 shadow-sm",
        outline:
          "bg-transparent text-foreground border border-border hover:bg-accent/30",
        ghost: "bg-transparent text-foreground hover:bg-accent/30",
        destructive:
          "bg-destructive text-white hover:opacity-90",
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

