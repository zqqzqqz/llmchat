import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Loader2,
  Mic,
  Phone,
  PhoneOff,
  User,
  Volume2,
} from 'lucide-react';
import { Agent } from '@/types';
import { Button } from '@/components/ui/Button';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';

type CallStatus = 'idle' | 'connecting' | 'in-call' | 'ended';

interface BrowserSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onaudioend: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  onend: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: BrowserSpeechRecognition, ev: any) => any) | null;
  onresult: ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionEvent) => any) | null;
  onstart: ((this: BrowserSpeechRecognition, ev: Event) => any) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

interface VoiceCallWorkspaceProps {
  agent: Agent;
}

export const VoiceCallWorkspace: React.FC<VoiceCallWorkspaceProps> = ({ agent }) => {
  const {
    messages,
    isStreaming,
    streamingStatus,
    clearMessages,
    createNewSession,
  } = useChatStore();
  const { sendMessage } = useChat();

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [listening, setListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastUtterance, setLastUtterance] = useState('');
  const [recognitionSupported, setRecognitionSupported] = useState(true);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number>();
  const callStatusRef = useRef<CallStatus>('idle');
  const spokenMessageRef = useRef<Set<string>>(new Set());
  const callStartRef = useRef<number | null>(null);
  const finalUtterancesRef = useRef<string[]>([]);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const conversationMessages = useMemo(
    () =>
      messages.filter(
        (message) => typeof message.HUMAN === 'string' || typeof message.AI === 'string'
      ),
    [messages]
  );

  useEffect(() => {
    setRecognitionSupported(!!getSpeechRecognition());
  }, []);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    if (callStatus !== 'in-call') {
      callStartRef.current = null;
      setCallDuration(0);
      return;
    }

    callStartRef.current = Date.now();
    const interval = window.setInterval(() => {
      if (callStartRef.current) {
        setCallDuration(Date.now() - callStartRef.current);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [callStatus]);

  useEffect(() => {
    if (!conversationRef.current) return;
    conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [conversationMessages.length, interimTranscript]);

  const registerFinalUtterance = useCallback((utterance: string) => {
    const text = utterance.trim();
    if (!text) return false;
    if (finalUtterancesRef.current.includes(text)) {
      return false;
    }

    finalUtterancesRef.current = [...finalUtterancesRef.current.slice(-4), text];
    return true;
  }, []);

  const speakAssistantMessage = useCallback((text: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('语音播报失败', err);
    }
  }, []);

  useEffect(() => {
    if (callStatus !== 'in-call') return;
    if (conversationMessages.length === 0) return;

    const assistantMessages = conversationMessages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => typeof message.AI === 'string' && message.AI.trim().length > 0);

    if (assistantMessages.length === 0) return;

    const latest = assistantMessages[assistantMessages.length - 1];
    const key = latest.message.id || `assistant-${latest.index}`;

    if (spokenMessageRef.current.has(key)) return;
    if (isStreaming) return;
    if (streamingStatus?.type && streamingStatus.type !== 'complete') return;

    spokenMessageRef.current.add(key);
    speakAssistantMessage(latest.message.AI as string);
  }, [conversationMessages, callStatus, isStreaming, streamingStatus, speakAssistantMessage]);

  const cleanupAudio = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }

    setListening(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setVolume(0);
    setInterimTranscript('');
  }, []);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  const handleSendRecognizedText = useCallback(
    async (rawText: string) => {
      const content = rawText.trim();
      if (!content) return;

      try {
        await sendMessage(content, { detail: true });
        setLastUtterance(content);
      } catch (err) {
        console.error('发送语音消息失败', err);
        setError('发送语音消息失败，请稍后重试。');
      }
    },
    [sendMessage]
  );

  const handleStartCall = useCallback(async () => {
    if (callStatus === 'connecting' || callStatus === 'in-call') return;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持音频采集，请更换更现代的浏览器。');
      return;
    }

    setError(null);
    setInterimTranscript('');
    setLastUtterance('');
    spokenMessageRef.current.clear();
    finalUtterancesRef.current = [];
    setCallStatus('connecting');
    callStatusRef.current = 'connecting';

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext: AudioContext = new AudioContextCtor();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            const value = (dataArray[i] - 128) / 128;
            sumSquares += value * value;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          setVolume(Math.min(1, rms * 4));
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };

        updateVolume();
      }

      const RecognitionCtor = getSpeechRecognition();
      if (!RecognitionCtor) {
        setRecognitionSupported(false);
        setError('当前浏览器暂不支持实时语音识别，建议使用最新版 Chrome。');
      } else {
        const recognition: BrowserSpeechRecognition = new RecognitionCtor();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setListening(true);
        recognition.onend = () => {
          setListening(false);
          if (callStatusRef.current === 'in-call') {
            try {
              recognition.start();
            } catch (err) {
              console.warn('语音识别重启失败', err);
            }
          }
        };
        recognition.onerror = (event: any) => {
          if (event?.error === 'aborted' || event?.error === 'no-speech') return;
          setError(`语音识别出错：${event?.error ?? '未知错误'}`);
        };
        recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            const transcript = result[0]?.transcript?.trim();
            if (!transcript) continue;

            if (result.isFinal) {
              if (registerFinalUtterance(transcript)) {
                void handleSendRecognizedText(transcript);
              }
            } else {
              interim = `${interim} ${transcript}`.trim();
            }
          }
          setInterimTranscript(interim);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      clearMessages();
      createNewSession();

      setCallStatus('in-call');
      callStatusRef.current = 'in-call';
    } catch (err) {
      console.error('初始化语音通话失败', err);
      setError(err instanceof Error ? err.message : '无法启动语音通话，请检查设备权限。');
      cleanupAudio();
      setCallStatus('idle');
      callStatusRef.current = 'idle';
    }
  }, [callStatus, clearMessages, createNewSession, cleanupAudio, handleSendRecognizedText, registerFinalUtterance]);

  const handleStopCall = useCallback(() => {
    if (callStatus === 'idle') return;
    setCallStatus('ended');
    callStatusRef.current = 'ended';
    cleanupAudio();
  }, [callStatus, cleanupAudio]);

  const statusLabel: Record<CallStatus, string> = {
    idle: '等待开始',
    connecting: '正在连接…',
    'in-call': '通话中',
    ended: '通话已结束',
  };

  const volumePercent = Math.round(Math.min(1, volume) * 100);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-brand/15 via-background/80 to-background/60 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-brand/80">实时语音通话</p>
            <h2 className="text-2xl font-semibold text-foreground">{agent.name}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">{agent.description}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm text-muted-foreground">{statusLabel[callStatus]}</span>
              {callStatus === 'in-call' && (
                <span className="font-mono text-sm text-brand">{formatDuration(callDuration)}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleStartCall}
                disabled={callStatus === 'connecting' || callStatus === 'in-call'}
                variant="brand"
                size="lg"
                radius="lg"
                className="gap-2 shadow-lg"
              >
                {callStatus === 'connecting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                {callStatus === 'in-call' ? '通话中' : '开始通话'}
              </Button>
              <Button
                onClick={handleStopCall}
                disabled={callStatus === 'idle' || callStatus === 'ended'}
                variant="outline"
                size="lg"
                radius="lg"
                className={cn(
                  'gap-2 border-destructive/40 text-destructive hover:bg-destructive/10',
                  callStatus === 'idle' || callStatus === 'ended' ? 'opacity-50' : ''
                )}
              >
                <PhoneOff className="h-4 w-4" />
                结束通话
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20">
              <Mic className="h-5 w-5 text-brand" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">麦克风状态</p>
              <p className="text-xs text-muted-foreground">
                {listening ? '正在倾听，请开始讲话…' : '待命中，点击开始通话后开始识别'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20">
              <Volume2 className="h-5 w-5 text-brand" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">音量监测</p>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand via-brand/80 to-brand/60 transition-all"
                  style={{ width: `${volumePercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">当前输入电平：{volumePercent}%</p>
            </div>
          </div>
        </div>

        {interimTranscript && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-brand">语音识别中：</span> {interimTranscript}
          </div>
        )}

        {lastUtterance && callStatus === 'in-call' && (
          <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm text-brand">
            <span className="font-medium">上次识别结果：</span> {lastUtterance}
          </div>
        )}

        {!recognitionSupported && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-100/20 p-4 text-sm text-amber-500">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            当前浏览器暂不支持 Web Speech API，语音识别功能可能不可用。建议在桌面端 Chrome 浏览器中体验完整语音能力。
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden rounded-3xl border border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">通话记录</h3>
            <p className="text-xs text-muted-foreground">语音识别文本与助手回复将实时呈现，贴近电话对话体验。</p>
          </div>
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-brand">
              <Loader2 className="h-4 w-4 animate-spin" />
              助手正在组织回答…
            </div>
          )}
        </div>

        <div ref={conversationRef} className="h-full space-y-4 overflow-y-auto px-6 py-6">
          {conversationMessages.length === 0 && !interimTranscript ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <Mic className="h-6 w-6 text-brand" />
              点击“开始通话”后即可开口说话，助手会实时识别语音并以语音回复。
            </div>
          ) : (
            <>
              {conversationMessages.map((message, index) => {
                const isUser = typeof message.HUMAN === 'string';
                const key = message.id || `${isUser ? 'user' : 'assistant'}-${index}`;
                const content = isUser ? message.HUMAN : message.AI;
                if (!content) return null;

                return (
                  <div
                    key={key}
                    className={cn(
                      'flex gap-3',
                      isUser ? 'flex-row-reverse text-right' : 'flex-row text-left'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full shadow-inner',
                        isUser ? 'bg-brand text-white' : 'bg-white/10 text-brand'
                      )}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg',
                        isUser
                          ? 'bg-brand text-brand-foreground rounded-tr-sm'
                          : 'bg-white/5 text-foreground rounded-tl-sm'
                      )}
                    >
                      {content}
                    </div>
                  </div>
                );
              })}

              {interimTranscript && (
                <div className="flex justify-end">
                  <div className="rounded-2xl bg-brand/10 px-4 py-2 text-xs text-brand">
                    正在识别：{interimTranscript}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
