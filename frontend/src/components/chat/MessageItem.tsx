import React, { useState } from 'react';
import { User, Copy, Check, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { ChatMessage, Agent, StreamStatus } from '@/types';
import 'highlight.js/styles/github-dark.css';
import { useChatStore } from '@/store/chatStore';
import { chatService } from '@/services/api';
import { useI18n } from '@/i18n';

import avatarImg from '@/img/4.png';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  currentAgent?: Agent;
  streamingStatus?: StreamStatus;
  // 为了兼容 init 交互，放宽参数类型
  onInteractiveSelect?: (value: any) => void;
  onInteractiveFormSubmit?: (values: any) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming = false,
  onRetry,
  onEdit: _onEdit,
  onDelete: _onDelete,
  currentAgent,
  streamingStatus,
  onInteractiveSelect,
  onInteractiveFormSubmit
}) => {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  // 交互节点专用渲染（优先于普通 HUMAN/AI 文本）
  if (message.interactive) {
    const data = message.interactive;

    // userInput 表单的本地状态
    const [formValues, setFormValues] = useState<Record<string, any>>({});

    // userSelect 下拉选择的本地状态
    const [selectedValue, setSelectedValue] = useState<string>(() => {
      const opts = (data.params as any)?.userSelectOptions || [];
      return (opts[0]?.key ?? opts[0]?.value ?? '') as string;
    });


    const renderUserSelect = () => (
      <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-[80%] w-full">
          <img src={avatarImg} alt="AI" className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted" />
          <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
            <div className="text-sm text-foreground mb-3 whitespace-pre-wrap">
              {data.params?.description || t('请选择一个选项以继续')}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
              >
                {(data.params as any)?.userSelectOptions?.map((opt: any, idx: number) => (
                  <option key={idx} value={String(opt.key ?? opt.value)}>
                    {String(opt.value ?? opt.key)}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => { if ((data as any).origin === 'init') { const varKey = (data.params as any)?.varKey; onInteractiveSelect?.({ origin: 'init', key: varKey, value: selectedValue }); } else { onInteractiveSelect?.(selectedValue); } }}
                variant="brand"
                size="md"
                radius="md"
                className="px-3 py-1.5"
              >











                {(data as any).origin === 'init' ? t('开始对话') : t('确定')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );

    const renderUserInput = () => (
      <div className="flex justify-start">
        <div className="flex items-start gap-3 max-w-[80%] w-full">
          <img src={avatarImg} alt="AI" className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted" />
          <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
            <div className="text-sm text-gray-700 dark:text-gray-200 mb-3 whitespace-pre-wrap">
              {data.params?.description || t('请填写表单以继续')}
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if ((data as any).origin === 'init') {
                  onInteractiveFormSubmit?.({ origin: 'init', values: formValues });
                } else {
                  onInteractiveFormSubmit?.(formValues);
                }
              }}
            >
              {(data.params as any)?.inputForm?.map((item: any, idx: number) => {
                const key = item?.key || `field_${idx}`;
                const label = item?.label || key;
                const type = item?.type || 'input';
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <label className="w-28 text-sm text-muted-foreground">{label}</label>
                    {type === 'numberInput' ? (
                      <input
                        type="number"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        onChange={(e) => setFormValues((s) => ({ ...s, [key]: Number(e.target.value) }))}
                      />
                    ) : type === 'select' ? (
                      <select
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        onChange={(e) => setFormValues((s) => ({ ...s, [key]: e.target.value }))}
                      >
                        {(item.list || []).map((opt: any, i: number) => (
                          <option key={i} value={String(opt.value)}>
                            {String(opt.label ?? opt.value)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        onChange={(e) => setFormValues((s) => ({ ...s, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="brand"
                  size="md"
                  radius="md"
                  className="px-4 py-2 text-sm"
                >
                  {(data as any).origin === 'init' ? t('开始对话') : t('提交')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );

    if (data.type === 'userSelect') return renderUserSelect();
    if (data.type === 'userInput') return renderUserInput();
  }

  const [likeLoading, setLikeLoading] = useState<boolean>(false);

  // huihua.md 格式：检查是用户消息还是 AI 消息
  const isUser = message.HUMAN !== undefined;
  const content = isUser ? message.HUMAN : message.AI;

  // 从全局store获取当前会话和反馈更新方法
  const { currentSession, setMessageFeedback } = useChatStore();
  const agent = currentAgent; // 已通过props传入
  const canFeedback = !isUser && !!message.id && agent?.provider === 'fastgpt';

  // 由消息上的持久化字段推导本地显示态
  const liked: boolean | null = message.feedback === 'good' ? true : message.feedback === 'bad' ? false : null;

  const submitFeedback = async (type: 'good' | 'bad', cancel = false) => {
    if (!canFeedback || !agent || !currentSession) return;
    setLikeLoading(true);
    try {
      await chatService.updateUserFeedback(agent.id, currentSession.id, message.id!, type, cancel);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleLikeClick = async () => {
    if (!canFeedback || likeLoading) return;
    try {
      if (liked === true) {
        await submitFeedback('good', true);
        setMessageFeedback(message.id!, null);
      } else {
        if (liked === false) {
          await submitFeedback('bad', true);
        }
        await submitFeedback('good', false);
        setMessageFeedback(message.id!, 'good');
      }
    } catch (e) {
      console.error(t('点赞操作失败'), e);
    }
  };

  const handleDislikeClick = async () => {
    if (!canFeedback || likeLoading) return;
    try {
      if (liked === false) {
        await submitFeedback('bad', true);
        setMessageFeedback(message.id!, null);
      } else {
        if (liked === true) {
          await submitFeedback('good', true);
        }
        await submitFeedback('bad', false);
        setMessageFeedback(message.id!, 'bad');
      }
    } catch (e) {
      console.error(t('点踩操作失败'), e);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(t('复制失败'), err);
    }
  };

  const formatTime = () => {
    return new Date().toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 用户消息样式
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="bg-brand text-brand-foreground rounded-2xl px-4 py-3 shadow-sm">
            <div className="whitespace-pre-wrap break-words">
              {content}
            </div>
            <div className="text-xs text-blue-100 mt-2 text-right">
              {formatTime()}
            </div>
          </div>
          <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-border">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // 助手消息样式
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[80%] w-full">
        <img src={avatarImg} alt="AI" className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted" />

        <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
          {/* 消息内容 */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeHighlight, rehypeRaw]}
              components={{
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\\w+)/.exec(className || '');
                  const isBlock = match && className;

                  if (isBlock) {
                    return (
                      <div className="relative group">
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={() => navigator.clipboard.writeText(String(children))}
                            variant="secondary"
                            size="sm"
                            radius="md"
                            className="px-2 py-1 h-auto text-xs"
                          >
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-background border border-border rounded-lg overflow-x-auto p-4 text-sm">
                          <code className={className}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  }

                  return (
                    <code className="bg-muted px-1 py-0.5 rounded text-sm text-muted-foreground" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>

            {/* 在气泡内部渲染 FastGPT 状态面板（替代原三点动画） */}
            {isStreaming && currentAgent?.provider === 'fastgpt' && (
              <div className="flex justify-start mt-2">
                <div className="flex items-center space-x-2 px-4 py-2 rounded-lg shadow-sm border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {/* 简单的“流程节点”图标 */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="6" cy="12" r="2"></circle>
                    <circle cx="12" cy="6" r="2"></circle>
                    <circle cx="18" cy="12" r="2"></circle>
                    <path d="M8 12h4M14 10l2-2M14 12h2"></path>
                  </svg>
                  {/* 三点动画 */}
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm"></span>
                  {streamingStatus?.type === 'flowNodeStatus' && (
                    <>
                      <span className="text-sm font-medium">{streamingStatus.moduleName || t('未知模块')}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-1 ${
                        streamingStatus.status === 'error'
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : (streamingStatus.status === 'completed'
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300')
                      }`}>
                        {streamingStatus.status || 'running'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 消息元数据 */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{formatTime()}</span>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <IconButton
                onClick={handleCopy}
                variant="ghost"
                radius="md"
                title={t('复制')}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </IconButton>

              {onRetry && (
                <IconButton
                  onClick={onRetry}
                  variant="ghost"
                  radius="md"
                  className="text-muted-foreground hover:text-foreground"
                  title={t('重新生成')}
                >
                  <RotateCcw className="h-4 w-4" />
                </IconButton>
              )}

              {canFeedback && (
                <>
                  <IconButton
                    onClick={handleLikeClick}
                    variant="ghost"
                    radius="md"
                    disabled={likeLoading}
                    className={`${
                      liked === true
                        ? 'text-green-500'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={t('点赞')}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </IconButton>

                  <IconButton
                    onClick={handleDislikeClick}
                    variant="ghost"
                    radius="md"
                    disabled={likeLoading}
                    className={`${
                      liked === false
                        ? 'text-red-500'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={t('点踩')}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </IconButton>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};