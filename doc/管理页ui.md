You are tasked with integrating an existing React component bundle into the codebase.

The codebase should support:
- React with TypeScript
- Tailwind CSS (v3 or v4)
- Modern build tools (Vite/Next.js)

If your project doesn't support these, provide instructions on how to set them up.

IMPORTANT: The App.tsx file is a showcase/example demonstrating the component usage. You should:
1. Analyze the App component to understand how all the pieces work together
2. Review the supporting components and utilities 
3. Integrate the relevant parts into your project structure
4. Adapt the implementation to match your project's patterns and requirements

## Installation

```bash
npm install framer-motion lucide-react @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```

## Styles

### index.css

```css
/* This is Tailwind 4 CSS file */
/* Extending Tailwind configuration */
/* Use shadcn/ui format to extend the configuration */
/* Add only the styles that your component needs */

/* Base imports */
@import "tailwindcss";
@import "tw-animate-css";

/* Custom dark variant for targeting dark mode elements */
@custom-variant dark (&:is(.dark *));

/* CSS variables and theme definitions */
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

/* Light theme variables */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

/* Dark theme variables */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

/* Tailwind base styles */
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

```


## Component Files

### lib/utils.ts

```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### components/ui/button.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
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
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

```

### components/ui/input.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }

```

### App.tsx

```tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  Menu, 
  X, 
  Home, 
  Users, 
  BarChart3, 
  Settings, 
  Bell, 
  Search,
  ChevronDown,
  MessageSquare,
  Calendar,
  FileText,
  LogOut,
  User,
  Moon,
  Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Login Page Component
const LoginPage = ({ onLogin }: { onLogin: () => void }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    onLogin();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-br from-[#6cb33f]/5 via-background to-[#6cb33f]/10 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md"
      >
        <div className="bg-background/90 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#6cb33f] to-[#6cb33f]/80 flex items-center justify-center shadow-lg"
            >
              <span className="text-2xl font-bold text-white">V5</span>
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-2">欢迎回来</h1>
            <p className="text-muted-foreground">登录到您的 Variant 5 账户</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-medium text-foreground mb-2">邮箱地址</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="输入您的邮箱"
                  className="pl-11 h-12 rounded-xl border-border/30 bg-background/50 backdrop-blur-sm focus:border-[#6cb33f]/50 focus:ring-[#6cb33f]/20"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-medium text-foreground mb-2">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入您的密码"
                  className="pl-11 pr-11 h-12 rounded-xl border-border/30 bg-background/50 backdrop-blur-sm focus:border-[#6cb33f]/50 focus:ring-[#6cb33f]/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-between"
            >
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded border-border/30 text-[#6cb33f] focus:ring-[#6cb33f]/20" />
                <span className="text-sm text-muted-foreground">记住我</span>
              </label>
              <a href="#" className="text-sm text-[#6cb33f] hover:text-[#6cb33f]/80 transition-colors">
                忘记密码？
              </a>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#6cb33f] to-[#6cb33f]/90 hover:from-[#6cb33f]/90 hover:to-[#6cb33f]/80 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  "登录"
                )}
              </Button>
            </motion.div>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-muted-foreground">
              还没有账户？{" "}
              <a href="#" className="text-[#6cb33f] hover:text-[#6cb33f]/80 transition-colors font-medium">
                立即注册
              </a>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Sidebar Component
const Sidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }: {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const [activeItem, setActiveItem] = useState("dashboard");

  const navigationItems = [
    { id: "dashboard", name: "仪表板", icon: Home, badge: null },
    { id: "users", name: "用户管理", icon: Users, badge: "12" },
    { id: "analytics", name: "数据分析", icon: BarChart3, badge: null },
    { id: "messages", name: "消息中心", icon: MessageSquare, badge: "3" },
    { id: "calendar", name: "日程安排", icon: Calendar, badge: null },
    { id: "documents", name: "文档管理", icon: FileText, badge: null },
    { id: "settings", name: "系统设置", icon: Settings, badge: null },
  ];

  const sidebarContent = (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`h-full bg-background/95 backdrop-blur-xl border-r border-border/50 shadow-2xl flex flex-col ${
        collapsed ? "w-20" : "w-64"
      } transition-all duration-300`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6cb33f] to-[#6cb33f]/80 flex items-center justify-center">
                <span className="text-sm font-bold text-white">V5</span>
              </div>
              <span className="font-semibold text-foreground">Variant 5</span>
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={collapsed ? onToggleCollapse : onClose}
            className="rounded-lg hover:bg-muted/50"
          >
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </Button>
        </div>
        
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索功能..."
                className="pl-10 h-9 rounded-lg bg-muted/30 border-border/30 focus:border-[#6cb33f]/50"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-2">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setActiveItem(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-gradient-to-r from-[#6cb33f]/20 to-[#6cb33f]/10 text-[#6cb33f] border border-[#6cb33f]/20"
                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-[#6cb33f]" : ""}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#6cb33f]/20 text-[#6cb33f]">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-border/50">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6cb33f] to-[#6cb33f]/80 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">张三</div>
              <div className="text-xs text-muted-foreground">管理员</div>
            </div>
          )}
        </div>
        
        {!collapsed && (
          <Button
            variant="ghost"
            className="w-full mt-3 justify-start gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </Button>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full z-40">
        {sidebarContent}
      </div>
      
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />
            <div className="absolute left-0 top-0 h-full w-64">
              {sidebarContent}
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

// Top Header Component
const TopHeader = ({ onToggleSidebar, sidebarCollapsed }: {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}) => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`sticky top-0 z-30 h-16 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm transition-all duration-300 ${
        sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      }`}
    >
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div>
            <h1 className="text-lg font-semibold text-foreground">仪表板</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">欢迎回来，张三</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:block relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="全局搜索..."
              className="pl-10 w-64 h-9 rounded-lg bg-muted/30 border-border/30 focus:border-[#6cb33f]/50"
            />
          </div>
          
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative rounded-lg">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">3</span>
            </span>
          </Button>
          
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-lg"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          
          {/* Profile */}
          <Button variant="ghost" className="flex items-center gap-2 rounded-lg p-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6cb33f] to-[#6cb33f]/80 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:block text-sm font-medium">张三</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.header>
  );
};

// Main Dashboard Content
const DashboardContent = ({ sidebarCollapsed }: { sidebarCollapsed: boolean }) => {
  return (
    <main className={`transition-all duration-300 ${
      sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
    }`}>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stats Cards */}
          {[
            { title: "总用户数", value: "12,345", change: "+12%", icon: Users },
            { title: "今日访问", value: "2,468", change: "+8%", icon: BarChart3 },
            { title: "消息数量", value: "1,234", change: "+23%", icon: MessageSquare },
            { title: "任务完成", value: "89%", change: "+5%", icon: Calendar },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-[#6cb33f]/10">
                    <Icon className="w-6 h-6 text-[#6cb33f]" />
                  </div>
                  <span className="text-sm font-medium text-green-600">{stat.change}</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.title}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">数据趋势</h3>
              <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">图表区域</p>
              </div>
            </motion.div>
          </div>
          
          {/* Sidebar Content */}
          <div className="space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">最近活动</h3>
              <div className="space-y-3">
                {[
                  "用户 张三 登录系统",
                  "新增 5 条数据记录",
                  "系统备份完成",
                  "收到 3 条新消息",
                ].map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-[#6cb33f]"></div>
                    <span className="text-sm text-muted-foreground">{activity}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
};

// Main App Component
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="flex flex-col min-h-screen">
        <TopHeader
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <DashboardContent sidebarCollapsed={sidebarCollapsed} />
      </div>
    </div>
  );
}
```


## Tailwind Configuration

Add the following global styles:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
```

Custom colors detected: gradient-to-br, grid-pattern, muted-foreground, gradient-to-r, t-white, primary-foreground, accent-foreground, secondary-foreground
Make sure these are defined in your Tailwind configuration.


## Integration Instructions

1. Review the App.tsx component to understand the complete implementation
2. Identify which components and utilities you need for your use case
3. Analyze the Tailwind v4 styles in index.css - integrate custom styles that differ from integrating Codebase
4. Install the required NPM dependencies listed above
5. Integrate the components into your project, adapting them to fit your architecture

Focus on:
- Understanding projects structure, adding above components into it
- Understanding the component composition
- Identifying reusable utilities and helpers
- Adapting the styling to match your design system