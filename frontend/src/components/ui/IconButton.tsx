import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/Button";

export interface IconButtonProps extends Omit<ButtonProps, "size" | "variant"> {
  /**
   * 语义化的图标按钮外观：
   * - glass: 玻璃态渐变 + 边框 + 阴影（常用于顶栏/工具区）
   * - brand/secondary/outline/ghost/destructive: 直接复用 Button 的变体
   */
  variant?: ButtonProps["variant"] | "glass";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", radius = "md", ...props }, ref) => {
    const isGlass = variant === "glass";
    const baseGlass =
      "bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 hover:from-white/25 hover:to-white/10 text-foreground shadow-xl hover:shadow-2xl";

    // glass 走 secondary 基底以获得一致的焦点环和禁用态
    const mappedVariant: ButtonProps["variant"] = isGlass ? "secondary" : (variant as ButtonProps["variant"]);

    return (
      <Button
        ref={ref}
        size="icon"
        radius={radius}
        variant={mappedVariant}
        className={cn(isGlass ? baseGlass : "", className)}
        {...props}
      />
    );
  }
);
IconButton.displayName = "IconButton";

