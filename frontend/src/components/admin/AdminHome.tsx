"use client";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Home, Users, BarChart3, Settings, Sun, Moon, FileText, LogOut, User } from "lucide-react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import ReactECharts from 'echarts-for-react';

import { useAuthStore } from "@/store/authStore";
import { logoutApi, changePasswordApi } from "@/services/authApi";
import { getSystemInfo, getLogsPage, getUsers, exportLogsCsv, createUser, updateUser, resetUserPassword, type SystemInfo, type LogItem, type AdminUser } from "@/services/adminApi";
import { listAgents, reloadAgents, updateAgent as updateAgentApi, validateAgent, type AgentItem } from "@/services/agentsApi";
import { toast } from "@/components/ui/Toast";

export default function AdminHome() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState<'dashboard'|'users'|'analytics'|'documents'|'settings'|'logs'|'agents'>('dashboard');
  const [showChangePwd, setShowChangePwd] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const m = location.pathname.match(/^\/home\/?([^\/]+)?/);
    const tab = (m && m[1]) || 'dashboard';
    const allowed = new Set(['dashboard','users','analytics','documents','settings','logs','agents']);
    setActiveItem(allowed.has(tab) ? (tab as any) : 'dashboard');
  }, [location.pathname]);

  const onLogout = async () => {
    await logoutApi();
    logout();
    navigate('/login', { replace: true });
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        username={user?.username || "\u0000"}
        activeItem={activeItem}
        onChangeActive={(id) => navigate(`/home/${id}`)}
        onLogout={onLogout}
        onChangePassword={() => setShowChangePwd(true)}
      />

      <div className="flex flex-col min-h-screen">
        <TopHeader
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
          username={user?.username || "\u0000"}
          onLogout={onLogout}
          onChangePassword={() => setShowChangePwd(true)}
          title={{
            dashboard: '仪表板',
            users: '用户管理',
            analytics: '数据分析',
            documents: '文档管理',
            settings: '系统设置',
            logs: '日志管理',
            agents: '智能体管理',
          }[activeItem]}
          breadcrumb={[
            { label: '首页', to: '/home/dashboard' },
            { label: {dashboard:'仪表板',users:'用户管理',analytics:'数据分析',documents:'文档管理',settings:'系统设置',logs:'日志管理',agents:'智能体管理'}[activeItem] as string }
          ]}
        />
        {activeItem === 'dashboard' && <DashboardContent sidebarCollapsed={sidebarCollapsed} />}
        {activeItem === 'users' && <UsersManagement />}
        {activeItem === 'analytics' && <AnalyticsPanel />}
        {activeItem === 'documents' && <DocumentsPanel />}
        {activeItem === 'settings' && <SettingsPanel />}
        {activeItem === 'logs' && <LogsPanel />}
        {activeItem === 'agents' && <AgentsPanel />}
      </div>
      {showChangePwd && <ChangePasswordDialog onClose={() => setShowChangePwd(false)} onSuccess={() => { setShowChangePwd(false); onLogout(); }} />}
    </div>
  );
}

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse, username, activeItem, onChangeActive, onLogout, onChangePassword }: { isOpen: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void; username: string; activeItem: 'dashboard'|'users'|'analytics'|'documents'|'settings'|'logs'|'agents'; onChangeActive: (id: 'dashboard'|'users'|'analytics'|'documents'|'settings'|'logs'|'agents') => void; onLogout: () => void; onChangePassword: () => void; }) {

  const navigationItems = [
    { id: "dashboard", name: "仪表板", icon: Home, badge: null },
    { id: "users", name: "用户管理", icon: Users, badge: null },
    { id: "agents", name: "智能体管理", icon: Users, badge: null },
    { id: "analytics", name: "数据分析", icon: BarChart3, badge: null },
    { id: "logs", name: "日志管理", icon: FileText, badge: null },
    { id: "documents", name: "文档管理", icon: FileText, badge: null },
    { id: "settings", name: "系统设置", icon: Settings, badge: null },
  ];

  const sidebarContent = (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`h-full bg-background/95 backdrop-blur-xl border-r border-border/50 shadow-2xl flex flex-col ${collapsed ? "w-20" : "w-64"} transition-all duration-300`}
    >
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--brand)] to-[var(--brand)]/80 flex items-center justify-center">
                <span className="text-sm font-bold text-white">V5</span>
              </div>
              <span className="font-semibold text-foreground">Variant 5</span>
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches; // lg 断点
              if (isDesktop) {
                onToggleCollapse(); // 桌面：折叠/展开侧边栏
              } else {
                onClose(); // 移动：关闭抽屉
              }
            }}
            className="rounded-lg hover:bg-muted/50"
          >
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </Button>
        </div>

      </div>

      <div className="flex-1 p-4 space-y-2">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <motion.button key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} onClick={() => { onChangeActive(item.id as any); const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches; if (!isDesktop) onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? "bg-gradient-to-r from-[var(--brand)]/20 to-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
              <Icon className={`w-5 h-5 ${isActive ? "text-[var(--brand)]" : ""}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                  {item.badge && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--brand)]/20 text-[var(--brand)]">{item.badge}</span>}
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand)]/80 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{username || '管理员'}</div>
              <div className="text-xs text-muted-foreground">管理员</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <>
            <Button className="mt-3 items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 disabled:pointer-events-none bg-muted text-foreground hover:bg-accent/30 border border-border/50 shadow-sm h-10 px-4 hidden md:inline-flex rounded-lg" onClick={onChangePassword}>修改密码</Button>
            <Button variant="ghost" className="w-full mt-2 justify-start gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={onLogout}>
              <LogOut className="w-4 h-4" /> 退出登录
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <div className="hidden lg:block fixed left-0 top-0 h-full z-40">{sidebarContent}</div>
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="absolute left-0 top-0 h-full w-64">{sidebarContent}</div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function TopHeader({ onToggleSidebar, onToggleCollapse: _onToggleCollapse, sidebarCollapsed, username: _username, onLogout: _onLogout, onChangePassword: _onChangePassword, title, breadcrumb }: { onToggleSidebar: () => void; onToggleCollapse: () => void; sidebarCollapsed: boolean; username: string; onLogout: () => void; onChangePassword: () => void; title: string; breadcrumb: Array<{ label: string; to?: string }>; }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`sticky top-0 z-30 h-16 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden rounded-lg">
            <Menu className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-2">
              {breadcrumb.map((b, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i>0 && <span className="opacity-50">/</span>}
                  <span>{b.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-lg" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </motion.header>
  );
}

function DashboardContent({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  return (
    <main className={`transition-all duration-300 ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          {/* 1/2 大图表：一个月内每天每个智能体对话数量 */}
          {/* 顶部：对话数量折线图（近30天 · 按智能体/每天） */}
          <div className="lg:col-span-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">对话数量（近30天 · 按智能体/每天）</h3>
              <p className="text-xs text-muted-foreground mb-4">使用 ECharts 折线图（示例数据），后续可对接真实接口</p>
              <ConversationsLineChart />
            </motion.div>
          </div>

          {/* 左下：点踩数据量 */}
          <div className="lg:col-span-2">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">点踩（近30天）</h3>
              <DownvotesCard />
            </motion.div>
          </div>

          {/* 右下：服务器参数：内存/GPU/磁盘使用量 */}
          <div className="lg:col-span-2">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">服务器参数</h3>
              <ServerParamsCard />
            </motion.div>
          </div>

        </div>

      </div>
    </main>
  );
}



function DownvotesCard() {
  // 占位：统计总量 + 迷你条形
  const values = [2,4,3,6,5,8,7,6,5,4,6,7,5,4,3,5,6,4,3,2,1,2,3,2,4,3,5,4,3,2];
  const total = values.reduce((a,b)=>a+b,0);
  const max = Math.max(...values, 1);
  return (
    <div>
      <div className="text-3xl font-bold text-foreground">{total}</div>
      <div className="text-xs text-muted-foreground mb-3">近30天点踩次数</div>
      <div className="h-16 flex items-end gap-1">
        {values.map((v, i) => (
          <div key={i} className="w-[6px] bg-red-500/50 rounded-t" style={{ height: `${(v / max) * 64}px` }} />
        ))}
      </div>
    </div>
  );
}

function ServerParamsCard() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await getSystemInfo();
        setInfo(d);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const memPercent = info?.memory?.total ? Math.round((info.memory.used / info.memory.total) * 100) : null;
  return (
    <div className="space-y-3 text-sm">
      {loading && <div className="text-muted-foreground">加载中...</div>}
      {!loading && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">内存使用</span>
            <span className="font-medium">{memPercent !== null ? `${memPercent}%` : 'N/A'}</span>
          </div>
          <div className="h-2 w-full bg-muted/30 rounded">
            <div className="h-2 bg-[var(--brand)]/60 rounded" style={{ width: `${memPercent ?? 0}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">GPU 使用</span>
            <span className="font-medium">N/A</span>
          </div>
          <div className="h-2 w-full bg-muted/30 rounded">
            <div className="h-2 bg-[var(--brand)]/40 rounded" style={{ width: `0%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">磁盘使用</span>
            <span className="font-medium">N/A</span>
          </div>
          <div className="h-2 w-full bg-muted/30 rounded">
            <div className="h-2 bg-[var(--brand)]/40 rounded" style={{ width: `0%` }} />
          </div>
          <div className="text-xs text-muted-foreground">提示：GPU/磁盘暂未从后端提供，需扩展 /admin/system-info 接口</div>
        </>
      )}
    </div>
  );
}

function ConversationsLineChart() {
  // 生成近30天日期
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return `${d.getMonth()+1}/${d.getDate()}`;
  });
  // 模拟 3 个智能体数据
  const agents = ["FastGPT", "OpenAI", "Anthropic"];
  const series = agents.map((name, idx) => ({
    name,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2 },
    data: dates.map((_, di) => 10 + ((di * (idx+1)) % 8) + (idx*3)),
  }));
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    legend: { data: agents, top: 0, textStyle: { color: 'var(--muted-foreground)' } },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: 'var(--border)' } },
      axisLabel: { color: 'var(--muted-foreground)' },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(125,125,125,0.2)' } },
      axisLabel: { color: 'var(--muted-foreground)' },
    },
    series,
  } as const;
  return <ReactECharts option={option} style={{ height: 320 }} notMerge={true} lazyUpdate={true} />;
}





function LogsPanel() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [level, setLevel] = useState<''|'INFO'|'WARN'|'ERROR'>('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [total, setTotal] = useState<number>(0);

  const fetchData = async (p = page) => {
    try {
      setLoading(true);
      const d = await getLogsPage({ level: level || undefined, start: start || undefined, end: end || undefined, page: p, pageSize });
      setLogs(d.data);
      setTotal(d.total);
      setErr(null);
    } catch (e) {
      setErr('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); setPage(1); }, [level, start, end]);

  const onExport = async () => {
    try {
      const csv = await exportLogsCsv({ level: level || undefined, start: start || undefined, end: end || undefined });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'logs.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <div className="flex items-end gap-3 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">级别</label>
              <select value={level} onChange={e=>setLevel(e.target.value as any)} className="h-9 px-2 rounded-md bg-muted/30 border border-border/30">
                <option value="">全部</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">开始时间</label>
              <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="h-9 px-2 rounded-md bg-muted/30 border border-border/30" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">结束时间</label>
              <input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="h-9 px-2 rounded-md bg-muted/30 border border-border/30" />
            </div>
            <Button onClick={() => fetchData()}>查询</Button>
            <Button variant="secondary" onClick={onExport}>导出 CSV</Button>
          </div>

          <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
            <div>共 {total} 条 | 第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页</div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={()=>{ const p=Math.max(1,page-1); setPage(p); fetchData(p); }} disabled={page<=1}>上一页</Button>
              <Button variant="ghost" onClick={()=>{ const max=Math.max(1, Math.ceil(total / pageSize)); const p=Math.min(max, page+1); setPage(p); fetchData(p); }} disabled={page>=Math.max(1, Math.ceil(total / pageSize))}>下一页</Button>
            </div>
          </div>


          <h3 className="text-lg font-semibold text-foreground mb-4">日志管理</h3>
          {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}
          {!loading && !err && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">时间</th>
                    <th className="py-2">级别</th>
                    <th className="py-2">内容</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td className="py-2">{new Date(l.timestamp).toLocaleString()}</td>
                      <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${l.level==='ERROR'?'bg-red-100 text-red-700': l.level==='WARN'?'bg-yellow-100 text-yellow-800':'bg-sky-100 text-sky-700'}`}>{l.level}</span></td>
                      <td className="py-2">{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function UsersManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { (async () => {
    try { setLoading(true); const d = await getUsers(); setUsers(d); setErr(null); }
    catch { setErr('加载用户失败'); } finally { setLoading(false); }
  })(); }, []);
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">用户管理</h3>
            <Button onClick={async()=>{
              const username = window.prompt('请输入新用户名');
              if (!username) return;
              const password = window.prompt('请输入初始密码（至少6位）') || '';
              try {
                const u = await createUser({ username, password });
                setUsers((prev)=>[u, ...prev]);
              } catch (e:any) { toast({ type:'error', title: e?.response?.data?.message || '创建失败' }); }
            }}>新增用户</Button>
          </div>
          {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}
          {!loading && !err && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">ID</th>
                    <th className="py-2">用户名</th>
                    <th className="py-2">角色</th>
                    <th className="py-2">状态</th>
                    <th className="py-2">创建时间</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="py-2">{u.id}</td>
                      <td className="py-2">{u.username}</td>
                      <td className="py-2">{u.role || '-'}</td>
                      <td className="py-2">{u.status || '-'}</td>
                      <td className="py-2">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>


                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" onClick={async()=>{
                            const next = u.status === 'active' ? 'disabled' : 'active';
                            const nu = await updateUser({ id: u.id!, status: next });
                            setUsers(prev=> prev.map(x=> x.id===u.id? nu: x));
                          }}>{u.status === 'active' ? '禁用' : '启用'}</Button>
                          <Button variant="ghost" onClick={async()=>{
                            const ret = await resetUserPassword({ id: u.id! });
                            window.alert(`新密码: ${ret.newPassword}`);
                          }}>
                            重置密码
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function AnalyticsPanel() {
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">数据分析</h3>
          <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">图表区域（模拟）</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function DocumentsPanel() {
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">文档管理</h3>
          <div className="text-sm text-muted-foreground">此处为文档管理模块（模拟）。</div>
        </div>
      </div>
    </main>
  );
}

function SettingsPanel() {
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">系统设置</h3>
          <div className="text-sm text-muted-foreground">此处为系统设置模块（模拟）。</div>
        </div>
      </div>
    </main>
  );
}

function ChangePasswordDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const onSubmit = async () => {
    if (!oldPwd || !newPwd) { toast({ type: 'warning', title: '请输入完整信息' }); return; }
    if (newPwd !== confirmPwd) { toast({ type: 'error', title: '两次输入的新密码不一致' }); return; }
    try {
      setLoading(true);
      await changePasswordApi(oldPwd, newPwd);
      toast({ type: 'success', title: '修改密码成功，请重新登录' });
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '修改失败';
      toast({ type: 'error', title: msg });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">


      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md p-6 rounded-2xl bg-background border border-border/50 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground mb-4">修改密码</h3>
        <div className="space-y-3">
          <Input type="password" placeholder="原密码" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
          <Input type="password" placeholder="新密码" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
          <Input type="password" placeholder="确认新密码" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={onSubmit} disabled={loading}>{loading ? '提交中...' : '确定'}</Button>
        </div>
      </motion.div>
    </div>
  );
}


function AgentsPanel() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const fetchAgents = async () => {
    try { setLoading(true); const list = await listAgents({ includeInactive: true }); setAgents(list); setErr(null); }
    catch { setErr('加载智能体失败'); } finally { setLoading(false); }
  };
  useEffect(()=>{ fetchAgents(); }, []);
  const onReload = async () => { await reloadAgents(); await fetchAgents(); toast({ type:'success', title:'已重新加载' }); };
  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">智能体管理</h3>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onReload}>重新加载</Button>
            </div>
          </div>
          {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}
          {!loading && !err && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">ID</th>
                    <th className="py-2">名称</th>
                    <th className="py-2">模型</th>
                    <th className="py-2">状态</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {agents.map(a => (
                    <tr key={a.id}>
                      <td className="py-2">{a.id}</td>
                      <td className="py-2">{a.name}</td>
                      <td className="py-2">{a.model || '-'}</td>
                      <td className="py-2">{a.status}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" onClick={async()=>{
                            const nu = await updateAgentApi(a.id, { isActive: a.status !== 'active' });
                            setAgents(prev => prev.map(x => x.id===a.id? nu : x));
                          }}>{a.status==='active'?'禁用':'启用'}</Button>
                          <Button variant="ghost" onClick={async()=>{
                            const v = await validateAgent(a.id);
                            toast({ type: v.isValid? 'success':'error', title: v.isValid?'配置有效':'配置无效' });
                          }}>校验</Button>
                          <Button variant="ghost" onClick={async()=>{
                            const name = window.prompt('名称', a.name || '') || a.name;
                            const model = window.prompt('模型', a.model || '') || a.model;
                            const nu = await updateAgentApi(a.id, { name, model });
                            setAgents(prev => prev.map(x => x.id===a.id? nu : x));
                            toast({ type: 'success', title: '保存成功' });
                          }}>编辑</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
