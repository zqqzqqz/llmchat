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

### App.tsx

```tsx
"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Menu, X, Moon, Sun, ChevronDown, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  className?: string;
}

interface AgentOption {
  id: string;
  name: string;
  description: string;
}

const agentOptions: AgentOption[] = [
  { id: "gpt-4", name: "GPT-4", description: "Most capable model" },
  { id: "claude", name: "Claude", description: "Anthropic's assistant" },
  { id: "gemini", name: "Gemini", description: "Google's AI model" },
  { id: "llama", name: "Llama", description: "Meta's open model" },
];

const AgentSelector = ({ onAgentChange, selectedAgent }: { onAgentChange: (agent: AgentOption) => void; selectedAgent: AgentOption }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (agent: AgentOption) => {
    setIsOpen(false);
    onAgentChange(agent);
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-lg border border-white/30 hover:from-white/25 hover:to-white/10 transition-all duration-500 shadow-xl hover:shadow-2xl"
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="p-1.5 rounded-full bg-[#6cb33f]/20 shadow-inner">
          <Bot className="w-4 h-4 text-[#6cb33f] drop-shadow-sm" />
        </div>
        <span className="text-sm font-semibold text-foreground drop-shadow-sm">{selectedAgent.name}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-[#6cb33f]/70 drop-shadow-sm" />
        </motion.div>
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{
          opacity: isOpen ? 1 : 0,
          y: isOpen ? 0 : -10,
          scale: isOpen ? 1 : 0.95,
        }}
        transition={{ duration: 0.2 }}
        className={`absolute top-full left-0 mt-3 w-72 bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div className="p-3">
          {agentOptions.map((agent, index) => (
            <motion.button
              key={agent.id}
              onClick={() => handleSelect(agent)}
              className="w-full text-left p-4 rounded-xl hover:bg-gradient-to-br hover:from-[#6cb33f]/15 hover:to-[#6cb33f]/5 transition-all duration-300 group hover:shadow-lg"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6cb33f]/25 to-[#6cb33f]/10 flex items-center justify-center group-hover:from-[#6cb33f]/40 group-hover:to-[#6cb33f]/20 transition-all duration-300 shadow-inner">
                  <Bot className="w-5 h-5 text-[#6cb33f] drop-shadow-sm" />
                </div>
                <div>
                  <div className="font-semibold text-foreground drop-shadow-sm">{agent.name}</div>
                  <div className="text-xs text-muted-foreground/80">{agent.description}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <motion.button
      onClick={toggleTheme}
      className="p-3 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-lg border border-white/30 hover:from-white/25 hover:to-white/10 transition-all duration-500 shadow-xl hover:shadow-2xl"
      whileHover={{ scale: 1.08, rotate: 15 }}
      whileTap={{ scale: 0.92 }}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? (
          <Sun className="w-5 h-5 text-[#6cb33f] drop-shadow-sm" />
        ) : (
          <Moon className="w-5 h-5 text-[#6cb33f] drop-shadow-sm" />
        )}
      </motion.div>
    </motion.button>
  );
};

const MobileMenu = ({ isOpen, onClose, onAgentChange, selectedAgent }: { isOpen: boolean; onClose: () => void; onAgentChange: (agent: AgentOption) => void; selectedAgent: AgentOption }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      className={`fixed inset-0 z-50 lg:hidden ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: isOpen ? 0 : "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-background/95 backdrop-blur-md border-r border-border shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-foreground">Menu</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-xl"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">智能体选择</h3>
              <AgentSelector onAgentChange={onAgentChange} selectedAgent={selectedAgent} />
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">历史记录</h3>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-[#6cb33f]/5 border border-[#6cb33f]/10 hover:bg-[#6cb33f]/10 transition-colors cursor-pointer">
                  <div className="text-sm font-medium text-foreground">今天的对话</div>
                  <div className="text-xs text-muted-foreground mt-1">关于React组件优化的讨论</div>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="text-sm font-medium text-foreground">昨天的对话</div>
                  <div className="text-xs text-muted-foreground mt-1">API接口设计相关问题</div>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="text-sm font-medium text-foreground">上周的对话</div>
                  <div className="text-xs text-muted-foreground mt-1">数据库架构设计讨论</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Header: React.FC<HeaderProps> = ({ className = "" }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(agentOptions[0]);

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className={`sticky top-0 z-40 w-full backdrop-blur-xl bg-background/90 border-b border-border/50 shadow-2xl ${className}`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#6cb33f]/8 via-[#6cb33f]/3 to-[#6cb33f]/8" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/40" />

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Left side */}
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <motion.button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-3 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 hover:from-white/25 hover:to-white/10 transition-all duration-500 shadow-xl hover:shadow-2xl"
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.92 }}
              >
                <Menu className="w-5 h-5 text-[#6cb33f] drop-shadow-sm" />
              </motion.button>

              {/* Desktop agent selector */}
              <div className="hidden lg:block">
                <AgentSelector onAgentChange={setSelectedAgent} selectedAgent={selectedAgent} />
              </div>
            </div>

            {/* Center - Agent Title */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <AgentSelector onAgentChange={setSelectedAgent} selectedAgent={selectedAgent} />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Desktop theme toggle */}
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>

              {/* Mobile theme toggle */}
              <div className="lg:hidden">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#6cb33f]/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-[#6cb33f]/20 via-[#6cb33f]/80 to-[#6cb33f]/20 blur-sm" />
      </motion.header>

      {/* Mobile menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onAgentChange={setSelectedAgent}
        selectedAgent={selectedAgent}
      />
    </>
  );
};

export default function HeaderDemo() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            现代化智能体Header组件
          </h1>
          <p className="text-muted-foreground">
            使用绿色主题色 #6cb33f，具有现代化视觉效果、阴影、圆角和平滑过渡效果
          </p>
        </div>
      </main>
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

Custom colors detected: gradient-to-br, muted-foreground, gradient-to-r, gradient-to-b, primary-foreground, accent-foreground, secondary-foreground
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