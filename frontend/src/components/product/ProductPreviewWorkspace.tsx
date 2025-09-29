import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Camera, Upload, Sparkles, RefreshCcw, Loader2 } from 'lucide-react';
import { Agent } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import { productPreviewService } from '@/services/api';

interface ProductPreviewWorkspaceProps {
  agent: Agent;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

export const ProductPreviewWorkspace: React.FC<ProductPreviewWorkspaceProps> = ({ agent }) => {
  const sceneCanvasRef = useRef<HTMLDivElement>(null);
  const [sceneImagePreview, setSceneImagePreview] = useState<string>('');
  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [productQuery, setProductQuery] = useState('');
  const [personalization, setPersonalization] = useState('');
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>('');

  const resetBoundingBox = useCallback(() => {
    setBoundingBox(null);
    setStartPoint(null);
    setIsDrawing(false);
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

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!sceneImagePreview) return;
    event.preventDefault();
    const point = capturePoint(event.clientX, event.clientY);
    setStartPoint(point);
    setBoundingBox({ x: point.x, y: point.y, width: 0, height: 0 });
    setIsDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [capturePoint, sceneImagePreview]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint) return;
    const point = capturePoint(event.clientX, event.clientY);
    const x = Math.min(startPoint.x, point.x);
    const y = Math.min(startPoint.y, point.y);
    const width = Math.abs(point.x - startPoint.x);
    const height = Math.abs(point.y - startPoint.y);
    setBoundingBox({ x, y, width, height });
  }, [capturePoint, isDrawing, startPoint]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    event.preventDefault();
    setIsDrawing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, [isDrawing]);

  const boundingBoxStyle = useMemo(() => {
    if (!boundingBox) return undefined;
    return {
      left: `${boundingBox.x * 100}%`,
      top: `${boundingBox.y * 100}%`,
      width: `${boundingBox.width * 100}%`,
      height: `${boundingBox.height * 100}%`,
    } as React.CSSProperties;
  }, [boundingBox]);

  const canSubmit = !!sceneImagePreview && !!productQuery && boundingBox && boundingBox.width > 0.02 && boundingBox.height > 0.02;

  const handleSubmit = useCallback(async () => {
    if (!sceneImagePreview || !boundingBox) {
      toast({ type: 'warning', title: '请先上传现场照片并标记红框' });
      return;
    }
    if (!productQuery.trim()) {
      toast({ type: 'warning', title: '请输入产品名称或SKU' });
      return;
    }

    try {
      setSubmitting(true);
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
    } catch (error: any) {
      console.error('生成现场预览失败', error);
      const message = error?.response?.data?.message || error?.message || '生成现场预览失败，请稍后重试';
      toast({ type: 'error', title: '生成失败', description: message });
    } finally {
      setSubmitting(false);
    }
  }, [boundingBox, personalization, productImagePreview, productQuery, sceneImagePreview]);

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
                      <span className="text-sm text-muted-foreground">请按住鼠标或手指拖拽，标记红框区域</span>
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
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    >
                      {boundingBox && (
                        <div
                          className={cn(
                            'absolute border-[3px] border-red-500 bg-red-500/20 rounded-md shadow-lg transition-all duration-75',
                            isDrawing ? 'animate-pulse' : ''
                          )}
                          style={boundingBoxStyle}
                        />
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
                  <li>如需更精确，可多次重新标记；红框太小会影响生成效果。</li>
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
