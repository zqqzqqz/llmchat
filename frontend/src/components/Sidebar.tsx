import React, { useState, useRef } from 'react';
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
import { useChatStore } from '@/store/chatStore';
import { ChatSession } from '@/types';

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
  } = useChatStore();

  // huihua.md 要求：根据当前智能体id从localStorage获取会话列表并显示
  const sessionsToDisplay = currentAgent ? (agentSessions[currentAgent.id] || []) : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
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

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个对话吗？')) {
      deleteSession(sessionId);
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
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {icon}
          {title}
        </div>
        <div className="space-y-1">
          {groupSessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                currentSession?.id === session.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => {
                // huihua.md 要求：点击会话标题显示该会话的详细内容（messages列表）
                switchToSession(session.id);
              }}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0" />
              
              {editingId === session.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                      rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="p-1 text-green-600 hover:text-green-700"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-gray-600 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
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
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(session);
                      }}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 
          transform transition-transform duration-300 ease-in-out z-50 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto ${sidebarOpen ? 'lg:flex' : 'lg:hidden'} ${className}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 头部 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewSession}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 
              text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="h-5 w-5" />
            新建对话
          </button>
        </div>

        {/* 搜索 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索对话..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {sessionsToDisplay.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
    </>
  );
};