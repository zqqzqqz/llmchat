"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginApi } from "@/services/authApi";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/components/ui/Toast";

export default function LoginPage({ onSuccess }: { onSuccess?: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const data = await loginApi(username, password);
      login(data);
      toast({ type: 'success', title: '登录成功' });
      onSuccess?.();
    } catch (err) {
      setError("用户名或密码错误");
      toast({ type: 'error', title: '登录失败', description: '用户名或密码错误' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-[var(--brand)]/5 via-background to-[var(--brand)]/10 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 opacity-5" />
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-background/90 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand)]/80 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">V5</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">欢迎回来</h1>
            <p className="text-muted-foreground">登录到管理后台</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">用户名</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="输入用户名"
                  className="pl-11 h-12 rounded-xl border-border/30 bg-background/50 backdrop-blur-sm focus:border-[var(--brand)]/50 focus:ring-[var(--brand)]/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  className="pl-11 pr-11 h-12 rounded-xl border-border/30 bg-background/50 backdrop-blur-sm focus:border-[var(--brand)]/50 focus:ring-[var(--brand)]/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand)]/90 hover:from-[var(--brand)]/90 hover:to-[var(--brand)]/80 text-white font-semibold shadow-lg"
            >
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

