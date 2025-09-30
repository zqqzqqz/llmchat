import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Upload, Sparkles, RefreshCcw, Loader2 } from 'lucide-react';
import { Agent, ChatMessage } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import { productPreviewService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import { PRODUCT_PREVIEW_AGENT_ID } from '@/constants/agents';

interface ProductPreviewWorkspaceProps {
  agent: Agent;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ResizeDirection = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const PRODUCT_PREVIEW_SESSION_TYPE = 'product-preview';

const RESIZE_HANDLE_POSITION: Record<ResizeDirection, string> = {
  'top-left': 'left-[-0.5rem] top-[-0.5rem] cursor-nwse-resize',
  'top-right': 'right-[-0.5rem] top-[-0.5rem] cursor-nesw-resize',
  'bottom-left': 'left-[-0.5rem] bottom-[-0.5rem] cursor-nesw-resize',
  'bottom-right': 'right-[-0.5rem] bottom-[-0.5rem] cursor-nwse-resize',
};

type InteractionState =
  | { type: 'idle' }
  | { type: 'creating'; pointerId: number; origin: { x: number; y: number } }
  | { type: 'moving'; pointerId: number; origin: { x: number; y: number }; boxSnapshot: BoundingBox }
  | {
      type: 'resizing';
      pointerId: number;
      origin: { x: number; y: number };
      boxSnapshot: BoundingBox;
      direction: ResizeDirection;
    };

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const MIN_BOUND_SIZE = 0.02;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isPointWithinBox = (box: BoundingBox, point: { x: number; y: number }) =>
  point.x >= box.x &&
  point.x <= box.x + box.width &&
  point.y >= box.y &&
  point.y <= box.y + box.height;

export const ProductPreviewWorkspace: React.FC<ProductPreviewWorkspaceProps> = ({ agent }) => {
  const sceneCanvasRef = useRef<HTMLDivElement>(null);
  const [sceneImagePreview, setSceneImagePreview] = useState<string>('');
  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [productQuery, setProductQuery] = useState('');
  const [personalization, setPersonalization] = useState('');
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [interaction, setInteraction] = useState<InteractionState>({ type: 'idle' });

  const {
    currentAgent,
    currentSession,
    createNewSession,
    deleteSession,
    updateSession,
  } = useChatStore();

  const resetBoundingBox = useCallback(() => {
    setBoundingBox(null);
    setInteraction({ type: 'idle' });
  }, []);

  const handleSceneImageChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = await toBase64(file);
    setSceneImagePreview(preview);
    resetBoundingBox();
  }, [resetBoundingBox]);

  const handleProductImageChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = await toBase64(file);
    setProductImagePreview(preview);
  }, []);

  const capturePoint = useCallback((clientX: number, clientY: number) => {
    const container = sceneCanvasRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    return { x, y };
  }, []);

  const updateBoundingBoxForResize = useCallback(
    (direction: ResizeDirection, point: { x: number; y: number }, originBox: BoundingBox) => {
      const left = originBox.x;
      const top = originBox.y;
      const right = originBox.x + originBox.width;
      const bottom = originBox.y + originBox.height;

      let nextLeft = left;
      let nextTop = top;
      let nextRight = right;
      let nextBottom = bottom;

      if (direction === 'top-left' || direction === 'bottom-left') {
        nextLeft = clamp(point.x, 0, right - MIN_BOUND_SIZE);
      }
      if (direction === 'top-right' || direction === 'bottom-right') {
        nextRight = clamp(point.x, left + MIN_BOUND_SIZE, 1);
      }
      if (direction === 'top-left' || direction === 'top-right') {
        nextTop = clamp(point.y, 0, bottom - MIN_BOUND_SIZE);
      }
      if (direction === 'bottom-left' || direction === 'bottom-right') {
        nextBottom = clamp(point.y, top + MIN_BOUND_SIZE, 1);
      }

      const width = clamp(nextRight - nextLeft, MIN_BOUND_SIZE, 1);
      const height = clamp(nextBottom - nextTop, MIN_BOUND_SIZE, 1);

      return {
        x: clamp(nextLeft, 0, 1 - MIN_BOUND_SIZE),
        y: clamp(nextTop, 0, 1 - MIN_BOUND_SIZE),
        width,
        height,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!sceneImagePreview || event.button !== 0) return;

      const container = event.currentTarget;
      const point = capturePoint(event.clientX, event.clientY);
      const target = event.target as HTMLElement;
      const resizeHandle = (target?.dataset?.resizeHandle as ResizeDirection) || undefined;

      if (boundingBox && resizeHandle) {
        setInteraction({
          type: 'resizing',
          pointerId: event.pointerId,
          origin: point,
          boxSnapshot: boundingBox,
          direction: resizeHandle,
        });
        container.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      if (boundingBox && isPointWithinBox(boundingBox, point)) {
        setInteraction({
          type: 'moving',
          pointerId: event.pointerId,
          origin: point,
          boxSnapshot: boundingBox,
        });
        container.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      setBoundingBox({ x: point.x, y: point.y, width: 0, height: 0 });
      setInteraction({ type: 'creating', pointerId: event.pointerId, origin: point });
      container.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [boundingBox, capturePoint, sceneImagePreview]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (interaction.type === 'idle') return;

      const point = capturePoint(event.clientX, event.clientY);

      if (interaction.type === 'creating') {
        const { origin } = interaction;
        const x = Math.min(origin.x, point.x);
        const y = Math.min(origin.y, point.y);
        const width = Math.abs(point.x - origin.x);
        const height = Math.abs(point.y - origin.y);
        setBoundingBox({ x, y, width, height });
        return;
      }

      if (interaction.type === 'moving') {
        const { origin, boxSnapshot } = interaction;
        const deltaX = point.x - origin.x;
        const deltaY = point.y - origin.y;
        const nextWidth = boxSnapshot.width;
        const nextHeight = boxSnapshot.height;
        const nextX = clamp(boxSnapshot.x + deltaX, 0, 1 - nextWidth);
        const nextY = clamp(boxSnapshot.y + deltaY, 0, 1 - nextHeight);
        setBoundingBox({ x: nextX, y: nextY, width: nextWidth, height: nextHeight });
        return;
      }

      if (interaction.type === 'resizing') {
        const { direction, boxSnapshot } = interaction;
        const next = updateBoundingBoxForResize(direction, point, boxSnapshot);
        setBoundingBox(next);
      }
    },
    [capturePoint, interaction, updateBoundingBoxForResize]
  );

  const releaseInteraction = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (interaction.type === 'idle') return;
      if ((event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setInteraction({ type: 'idle' });
    },
    [interaction.type]
  );

  const boundingBoxStyle = useMemo(() => {
    if (!boundingBox) return undefined;
    return {
      left: `${boundingBox.x * 100}%`,
      top: `${boundingBox.y * 100}%`,
      width: `${boundingBox.width * 100}%`,
      height: `${boundingBox.height * 100}%`,
    } as React.CSSProperties;
  }, [boundingBox]);

  const canSubmit =
    !!sceneImagePreview &&
    !!productQuery &&
    boundingBox &&
    boundingBox.width > MIN_BOUND_SIZE &&
    boundingBox.height > MIN_BOUND_SIZE;

  const isCreating = interaction.type === 'creating';

  useEffect(() => {
    if (!currentSession || currentAgent?.id !== agent.id) {
      return;
    }

    const metadata = currentSession.metadata;
    if (!metadata || metadata.type !== PRODUCT_PREVIEW_SESSION_TYPE) {
      return;
    }

    const request = metadata.request || {};
    const response = metadata.response || {};

    if (typeof request.productQuery === 'string') {
      setProductQuery(request.productQuery);
    }
    if (typeof request.personalization === 'string') {
      setPersonalization(request.personalization);
    }
    if (typeof request.sceneImage === 'string') {
      setSceneImagePreview(request.sceneImage);
    }
    if (typeof request.productImage === 'string') {
      setProductImagePreview(request.productImage);
    }
    if (request.boundingBox) {
      setBoundingBox(request.boundingBox as BoundingBox);
    }
    const imageFromResponse = response.generatedImage || response.imageUrl || metadata.generatedImage;
    if (typeof imageFromResponse === 'string') {
      setGeneratedImage(imageFromResponse);
    }
  }, [agent.id, currentAgent?.id, currentSession]);

  const handleSubmit = useCallback(async () => {
    if (!sceneImagePreview || !boundingBox) {
      toast({ type: 'warning', title: '请先上传现场照片并标记红框' });
      return;
    }
    if (!productQuery.trim()) {
      toast({ type: 'warning', title: '请输入产品名称或SKU' });
      return;
    }

    if (currentAgent?.id !== PRODUCT_PREVIEW_AGENT_ID) {
      toast({ type: 'error', title: '当前智能体不是产品现场预览' });
      return;
    }

    let sessionId: string | null = null;
    try {
      setSubmitting(true);
      createNewSession();
      const latestSession = useChatStore.getState().currentSession;
      if (!latestSession || latestSession.agentId !== currentAgent.id) {
        toast({ type: 'error', title: '创建会话失败，请重试' });
        return;
      }

      sessionId = latestSession.id;
      const payload = {
        sceneImage: sceneImagePreview,
        productImage: productImagePreview || undefined,
        productQuery: productQuery.trim(),
        personalization: personalization.trim() || undefined,
        boundingBox,
      };
      const response = await productPreviewService.generatePreview(payload);
      const resultImage = response?.previewImage || response?.imageUrl;
      if (resultImage) {
        setGeneratedImage(resultImage);
        toast({ type: 'success', title: '生成成功', description: '已根据您的现场标记生成预览图' });
      } else {
        toast({ type: 'info', title: '请求已提交', description: '阿里图片生成接口已接收请求，请稍后刷新查看结果。' });
      }

      const now = new Date();
      const sessionTitle = productQuery.trim() || `现场预览 ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
      const metadata = {
        type: PRODUCT_PREVIEW_SESSION_TYPE,
        request: {
          sceneImage: sceneImagePreview,
          productImage: productImagePreview || '',
          productQuery: productQuery.trim(),
          personalization: personalization.trim(),
          boundingBox,
        },
        response: {
          generatedImage: resultImage || null,
          imageUrl: response?.imageUrl || null,
          previewImage: response?.previewImage || null,
          raw: response?.raw || response,
          status: response?.status || (resultImage ? 'completed' : 'submitted'),
        },
        timestamps: {
          submittedAt: now.toISOString(),
        },
      };

      const sessionMessages: ChatMessage[] = [
        {
          HUMAN: `现场预览请求：${productQuery.trim()}${personalization.trim() ? `，要求：${personalization.trim()}` : ''}`,
        },
        {
          AI: resultImage
            ? '预览图已生成，可在右侧查看效果。'
            : '请求已提交至图片生成接口，请稍后刷新查看结果。',
        },
      ];

      updateSession(currentAgent.id, sessionId, (session) => ({
        ...session,
        title: sessionTitle,
        metadata,
        messages: sessionMessages,
        updatedAt: now,
      }));
    } catch (error: any) {
      console.error('生成现场预览失败', error);
      const message = error?.response?.data?.message || error?.message || '生成现场预览失败，请稍后重试';
      toast({ type: 'error', title: '生成失败', description: message });
      if (sessionId) {
        deleteSession(sessionId);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    createNewSession,
    boundingBox,
    currentAgent?.id,
    deleteSession,
    personalization,
    productImagePreview,
    productQuery,
    sceneImagePreview,
    updateSession,
  ]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{agent.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
              拍摄或上传现场环境，引导用户框选目标区域，并结合产品素材与个性化需求，生成沉浸式的现场预览体验。
            </p>
          </div>
          <div className="flex items-center gap-3 bg-gradient-to-br from-brand/10 to-brand/5 border border-brand/30 rounded-2xl px-4 py-3">
            <Sparkles className="h-6 w-6 text-brand" />
            <div className="text-sm text-brand font-medium">阿里图片生成 · 现场合成</div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-brand/40 bg-white/60 dark:bg-gray-900/40 backdrop-blur p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Camera className="h-5 w-5 text-brand" /> 现场环境照片
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                建议开启手机后置摄像头拍摄现场，确保光线充足、构图完整。上传后请按提示在图片中标记需要摆放产品的红框区域。
              </p>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-muted-foreground">拍摄 / 上传现场</span>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleSceneImageChange}
                    className="mt-2 cursor-pointer"
                  />
                </label>

                {sceneImagePreview && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">拖动鼠标或手指标记红框，可在生成后继续拖动或缩放调整</span>
                      <Button variant="ghost" size="sm" onClick={resetBoundingBox}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> 重新标记
                      </Button>
                    </div>
                    <div
                      ref={sceneCanvasRef}
                      className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black/5"
                      style={{ backgroundImage: `url(${sceneImagePreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={releaseInteraction}
                      onPointerLeave={releaseInteraction}
                      onPointerCancel={releaseInteraction}
                    >
                      {boundingBox && (
                        <div
                          className={cn(
                            'absolute border-[3px] border-red-500 bg-red-500/20 rounded-md shadow-lg transition-all duration-75',
                            isCreating ? 'animate-pulse' : 'cursor-move'
                          )}
                          style={boundingBoxStyle}
                          data-bounding-box="true"
                        >
                          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-white/90 bg-red-500/80 backdrop-blur rounded-full px-3 py-1 shadow-sm">
                            拖动红框移动，拖四角微调范围
                          </div>
                          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as ResizeDirection[]).map((direction) => {
                            const baseClass =
                              'absolute w-4 h-4 rounded-full border-[2px] border-white bg-red-500 shadow-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400';

                            return (
                              <button
                                key={direction}
                                type="button"
                                data-resize-handle={direction}
                                className={cn(baseClass, RESIZE_HANDLE_POSITION[direction], 'pointer-events-auto')}
                                aria-label="调整红框"
                              />
                            );
                          })}
                        </div>
                      )}
                      {!boundingBox && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/40 text-white text-sm px-4 py-2 rounded-full">
                            在图片上拖拽绘制红框，标记要放置产品的位置
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-brand/20 bg-white/60 dark:bg-gray-900/40 backdrop-blur p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Upload className="h-5 w-5 text-brand" /> 产品素材照片（可选）
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                如已有产品官方或工作室素材，可上传以提升识别准确度；若为空，系统将根据产品关键词智能匹配阿里商品库。
              </p>
              <label className="block">
                <span className="text-sm font-medium text-muted-foreground">上传产品照片</span>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleProductImageChange}
                  className="mt-2 cursor-pointer"
                />
              </label>
              {productImagePreview && (
                <div className="mt-4">
                  <img
                    src={productImagePreview}
                    alt="产品素材预览"
                    className="rounded-xl border border-border/60 shadow-sm max-h-48 object-contain mx-auto"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-white/70 dark:bg-gray-900/60 backdrop-blur p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">产品查询</label>
                <Input
                  placeholder="请输入产品名称、型号或SKU，例如：松木简约餐桌"
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">个性化要求（可选）</label>
                <textarea
                  className="w-full min-h-[120px] resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-brand/40"
                  placeholder="填写颜色、材质、搭配建议等，如：希望与原有浅灰沙发协调，强调温暖灯光氛围"
                  value={personalization}
                  onChange={(event) => setPersonalization(event.target.value)}
                />
              </div>

              <div className="rounded-xl border border-dashed border-brand/30 bg-brand/5 p-4 text-sm text-brand/90 leading-relaxed">
                <p className="font-medium mb-1">标记技巧提示：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>确保红框覆盖完整的摆放区域，适当留出边距以便 AI 理解空间关系。</li>
                  <li>拖动红框本体可快速移动，拖动四角圆点可微调大小与比例。</li>
                  <li>如需重新绘制，可点击「重新标记」或在空白处重新拖拽。</li>
                  <li>提交后系统会保留思维链步骤，可在对话区查看生成历程。</li>
                </ul>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="w-full h-12 text-base font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    正在调用阿里图片生成接口...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    提交生成现场预览
                  </>
                )}
              </Button>
              {!canSubmit && (
                <p className="text-xs text-muted-foreground text-center">
                  请先上传现场照片并标记红框，同时填写产品查询信息后再提交。
                </p>
              )}
            </div>

            {generatedImage && (
              <div className="rounded-2xl border border-brand/40 bg-white/80 dark:bg-gray-900/60 backdrop-blur p-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand" /> 生成结果预览
                </h2>
                <p className="text-sm text-muted-foreground">
                  以下为阿里图片生成接口返回的现场预览，可下载或继续优化需求以获得更贴合的效果。
                </p>
                <img
                  src={generatedImage}
                  alt="现场预览生成结果"
                  className="w-full rounded-xl border border-border/60 shadow-lg"
                />
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = generatedImage;
                    link.download = 'product-scene-preview.png';
                    link.click();
                  }}
                >
                  下载预览图片
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
