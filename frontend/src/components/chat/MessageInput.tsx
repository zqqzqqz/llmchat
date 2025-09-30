import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ChatInputProps } from '@/types';

import { uploadAttachment } from '@/services/api';
import { ChatAttachmentMetadata, VoiceNoteMetadata } from '@/types';
import { toast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';


export const MessageInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = '输入消息...',
  isStreaming = false,
  onStopStreaming,
}) => {
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [attachments, setAttachments] = useState<ChatAttachmentMetadata[]>([]);
  const [voiceNote, setVoiceNote] = useState<VoiceNoteMetadata | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [message]);

  const canSend = Boolean(message.trim() || attachments.length > 0 || voiceNote);

  const resetRecordingState = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      resetRecordingState();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming) {
      toast({ type: 'info', title: t('正在生成中，请稍候') });
      return;
    }
    if (isRecording) {
      toast({ type: 'warning', title: t('请先结束录音') });
      return;
    }
    if (uploading) {
      toast({ type: 'warning', title: t('附件上传中，请稍候发送') });
      return;
    }
    if (canSend && !disabled) {
      const content = message.trim() || (voiceNote ? t('[语音消息]') : t('[附件]'));
      onSendMessage(content, {
        attachments: attachments.length ? attachments : undefined,
        voiceNote: voiceNote || undefined,
      });
      setMessage('');
      setAttachments([]);
      setVoiceNote(null);
      resetRecordingState();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileUpload = () => {

    if (disabled || uploading || isStreaming) return;
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads = Array.from(files).slice(0, 5);
      for (const file of uploads) {
        const uploaded = await uploadAttachment(file, { source: 'upload' });
        setAttachments((prev) => [...prev, uploaded]);
      }
      toast({ type: 'success', title: t('附件上传成功') });
    } catch (error) {
      console.error(t('附件上传失败'), error);
      toast({ type: 'error', title: t('附件上传失败，请重试') });
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    resetRecordingState();

  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (uploading || isStreaming) {
      toast({ type: 'warning', title: t('附件上传中，请稍后再试') });
      return;
    }

    try {
      setVoiceNote(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          recordedChunksRef.current = [];
          setUploading(true);
          const uploaded = await uploadAttachment(blob, {
            source: 'voice',
            filename: `voice-${Date.now()}.webm`,
          });
          setVoiceNote({
            id: uploaded.id,
            url: uploaded.url,
            duration: recordingDuration,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
          });
          toast({ type: 'success', title: t('语音已上传') });
        } catch (error) {
          console.error(t('语音上传失败'), error);
          toast({ type: 'error', title: t('语音上传失败，请重试') });
        } finally {
          setUploading(false);
          resetRecordingState();
        }
      };
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      mediaRecorderRef.current = recorder;
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 0.2);
      }, 200);
    } catch (error) {
      console.error(t('语音录制失败'), error);
      toast({ type: 'error', title: t('无法访问麦克风') });
      resetRecordingState();
    }
  };

  return (
    <div className="bg-background rounded-2xl border border-border/50 shadow-2xl backdrop-blur-md">
      {(attachments.length > 0 || voiceNote) && (
        <div className="px-4 pt-4 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 bg-accent/20 text-sm px-3 py-1 rounded-full max-w-full"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span className="truncate max-w-[160px]" title={att.name}>{att.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== att.id))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {voiceNote && (
            <div className="flex items-center gap-2 bg-emerald-500/10 text-sm px-3 py-1 rounded-full">
              <Mic className="h-3.5 w-3.5 text-emerald-500" />
              <span>{voiceNote.duration.toFixed(1)}s</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setVoiceNote(null)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4">
        {/* 附件按钮 */}
        <IconButton
          type="button"
          onClick={handleFileUpload}
          variant="glass"
          radius="md"
          className="flex-shrink-0"
          title={t('附件')}
          disabled={disabled || uploading || isStreaming}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </IconButton>

        {/* 文本输入区域 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t(placeholder)}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-transparent text-foreground
              placeholder-muted-foreground border-0 outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              scrollbar-thin scrollbar-thumb-muted"
            style={{ minHeight: '20px', maxHeight: '200px' }}
          />
        </div>

        {/* 右侧按钮组 */}
        <div className="flex items-center gap-2">
          {isStreaming && (
            <IconButton
              type="button"
              onClick={() => onStopStreaming?.()}
              variant="ghost"
              radius="md"
              className="flex-shrink-0 text-destructive hover:text-destructive"
              title={t('停止生成')}
            >
              <Square className="h-5 w-5" />
            </IconButton>
          )}
          {/* 语音记录按钮 */}
          <IconButton
            type="button"
            onClick={handleVoiceRecord}
            variant="ghost"
            radius="md"
            className={`flex-shrink-0 ${
              isRecording
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
            }`}
            title={isRecording ? t('停止录音') : t('语音输入')}
            disabled={disabled || isStreaming}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </IconButton>

          {/* 发送按钮 */}
          <Button
            type="submit"
            disabled={disabled || uploading || !canSend || isStreaming}
            variant="brand"
            size="icon"
            radius="md"
            title={t('发送消息 (Enter)')}
            className={`${disabled || uploading || !canSend || isStreaming ? '' : 'shadow-xl hover:shadow-2xl transform hover:scale-105'}`}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleFileInputChange}
      />

      {/* 移除输入提示文案 */}
    </div>
  );
};