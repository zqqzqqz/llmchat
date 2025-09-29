import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  Calendar,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useChatStore } from '@/store/chatStore';
import { ChatSession } from '@/types';
import { chatService } from '@/services/api';
import { mapHistorySummaryToSession, mapHistoryDetailToMessages } from '@/lib/fastgpt';
import { PRODUCT_PREVIEW_AGENT_ID, VOICE_CALL_AGENT_ID } from '@/constants/agents';

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const {
    agentSessions,        // 新的数据结构
    currentAgent,         // 当前智能体
    currentSession,
    sidebarOpen,
    setSidebarOpen,
    createNewSession,
    deleteSession,
    switchToSession,
    renameSession,
    setAgentSessionsForAgent,
    setSessionMessages,
  } = useChatStore();

  // huihua.md 要求：根据当前智能体id从localStorage获取会话列表并显示
  const sessionsToDisplay = currentAgent ? (agentSessions[currentAgent.id] || []) : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentAgent) return;
    if (currentAgent.id === PRODUCT_PREVIEW_AGENT_ID || currentAgent.id === VOICE_CALL_AGENT_ID) {
      return;
    }

    let cancelled = false;

    const loadHistories = async () => {
      try {
        const summaries = await chatService.listHistories(currentAgent.id);
        if (cancelled) return;
        const mapped = summaries.map((summary) => mapHistorySummaryToSession(currentAgent.id, summary));
        setAgentSessionsForAgent(currentAgent.id, mapped);
        if (mapped.length > 0) {
          try {
            const detail = await chatService.getHistoryDetail(currentAgent.id, mapped[0].id);
            if (!cancelled) {
              const messages = mapHistoryDetailToMessages(detail);
              setSessionMessages(mapped[0].id, messages);
            }
          } catch (detailError) {
            console.error('加载默认会话详情失败:', detailError);
          }
        }
      } catch (error) {
        console.error('加载聊天历史失败:', error);
      }
    };

    loadHistories();

    return () => {
      cancelled = true;
    };
  }, [currentAgent?.id, setAgentSessionsForAgent, setSessionMessages]);

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSwitchSession = async (session: ChatSession) => {
      switchToSession(session.id);

      if (!currentAgent) return;
      if (currentAgent.id === PRODUCT_PREVIEW_AGENT_ID || currentAgent.id === VOICE_CALL_AGENT_ID) return;
      if (session.messages && session.messages.length > 0) return;

    try {
      const detail = await chatService.getHistoryDetail(currentAgent.id, session.id);
      const mapped = mapHistoryDetailToMessages(detail);
      setSessionMessages(session.id, mapped);
    } catch (error) {
      console.error('加载聊天历史详情失败:', error);
    }
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      renameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentAgent) return;
    if (!confirm('确定要删除这个对话吗？')) return;

    if (currentAgent.id === PRODUCT_PREVIEW_AGENT_ID || currentAgent.id === VOICE_CALL_AGENT_ID) {
      deleteSession(sessionId);
      return;
    }

    try {
      await chatService.deleteHistory(currentAgent.id, sessionId);
      deleteSession(sessionId);
    } catch (error) {
      console.error('删除聊天历史失败:', error);
    }
  };

  // 处理手势滑动关闭侧边栏
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY) return;

    const touch = e.touches[0];
    const diffX = touchStartX - touch.clientX;
    const diffY = Math.abs(touchStartY - touch.clientY);

    // 水平滑动距离大于垂直滑动距离，且向左滑动超过50px
    if (diffX > 50 && diffY < 100) {
      setSidebarOpen(false);
      setTouchStartX(null);
      setTouchStartY(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartX(null);
    setTouchStartY(null);
  };

  // 日期判断函数
  const isToday = (date: Date) => {
    const today = new Date();
    const targetDate = new Date(date);
    return targetDate.toDateString() === today.toDateString();
  };

  const isYesterday = (date: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = new Date(date);
    return targetDate.toDateString() === yesterday.toDateString();
  };

  const isThisWeek = (date: Date) => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    const targetDate = new Date(date);
    return targetDate >= weekAgo && targetDate <= today;
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 过滤和分组会话（只处理当前智能体的会话）
  const filteredSessions = sessionsToDisplay.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedSessions = {
    today: filteredSessions.filter(s => isToday(s.updatedAt)),
    yesterday: filteredSessions.filter(s => isYesterday(s.updatedAt)),
    thisWeek: filteredSessions.filter(s => isThisWeek(s.updatedAt) && !isToday(s.updatedAt) && !isYesterday(s.updatedAt)),
    older: filteredSessions.filter(s => !isThisWeek(s.updatedAt))
  };

  const SessionGroup: React.FC<{ title: string; sessions: ChatSession[]; icon?: React.ReactNode }> = ({
    title,
    sessions: groupSessions,
    icon
  }) => {
    if (groupSessions.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {icon}
          {title}
        </div>
        <div className="space-y-1">
          {groupSessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                currentSession?.id === session.id
                  ? 'bg-brand/10 text-foreground'
                  : 'hover:bg-brand/10 text-foreground'
              }`}
              onClick={() => handleSwitchSession(session)}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0" />

              {editingId === session.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm rounded bg-background text-foreground border border-input focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button
                    onClick={handleSaveEdit}
                    variant="ghost"
                    size="icon"
                    radius="md"
                    className="text-brand hover:text-brand-hover"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="ghost"
                    size="icon"
                    radius="md"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {session.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(session.updatedAt)}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1 transition-opacity ${
                      currentSession?.id === session.id || editingId === session.id
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(session);
                      }}
                      variant="ghost"
                      radius="md"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="h-3 w-3" />
                    </IconButton>
                    <IconButton
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      variant="destructive"
                      radius="md"
                    >
                      <Trash2 className="h-3 w-3" />
                    </IconButton>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-transparent z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-80 bg-sidebar text-sidebar-foreground border-r border-sidebar-border
          transform transition-transform duration-300 ease-in-out z-50 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto ${sidebarOpen ? 'lg:flex' : 'lg:hidden'} ${className}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 头部 */}
        <div className="p-4 border-b border-border/50">
          <Button
            onClick={createNewSession}
            variant="brand"
            size="lg"
            radius="lg"
            className="w-full flex items-center gap-3 font-medium"
          >
            <Plus className="h-5 w-5" />
            新建对话
          </Button>

          {/* 隐藏清空对话按钮（业务要求不展示） */}
        </div>

        {/* 搜索 */}
        <div className="p-4 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索对话..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background text-foreground placeholder-muted-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus:border-transparent"
            />
          </div>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {sessionsToDisplay.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>还没有对话</p>
              <p className="text-sm">点击“新建对话”开始聊天</p>
            </div>
          ) : (
            <div>
              <SessionGroup
                title="今天"
                sessions={groupedSessions.today}
                icon={<Clock className="h-3 w-3" />}
              />
              <SessionGroup
                title="昨天"
                sessions={groupedSessions.yesterday}
                icon={<Clock className="h-3 w-3" />}
              />
              <SessionGroup
                title="本周"
                sessions={groupedSessions.thisWeek}
                icon={<Calendar className="h-3 w-3" />}
              />
              <SessionGroup
                title="更早"
                sessions={groupedSessions.older}
                icon={<Calendar className="h-3 w-3" />}
              />
            </div>
          )}
        </div>
      </aside>

      {/* 隐藏清空对话确认弹窗（不影响管理端） */}

    </>
  );
};
