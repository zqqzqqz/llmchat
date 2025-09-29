import axios from 'axios';
import { ProductPreviewRequest, ProductPreviewResult } from '@/types';

// 定义豆包 / OpenAI 风格图片生成接口可能返回的数据结构（兼容多种字段命名）
interface ProductPreviewApiResponse {
  requestId?: string;
  RequestId?: string;
  request_id?: string;
  traceId?: string;
  TraceId?: string;
  status?: string;
  Status?: string;
  // OpenAI / Doubao 风格
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  created?: number;
  usage?: Record<string, any>;
  // 兼容其他服务字段
  result?: {
    url?: string;
    imageUrl?: string;
    imageBase64?: string;
    image_base64?: string;
  };
  output?: {
    image_url?: string;
    results?: Array<{
      url?: string;
      data?: string;
    }>;
  };
  imageUrl?: string;
  imageBase64?: string;
  image_base64?: string;
}

const normalizeDataUrl = (image: string): string => {
  if (!image) return image;
  if (image.startsWith('data:')) return image;
  return `data:image/png;base64,${image}`;
};

export class ProductPreviewService {
  private endpoint: string;
  private apiKey: string | undefined;
  private model: string | undefined;
  private size: string | undefined;
  private stream: boolean;

  constructor() {
    // 默认使用 Ark Doubao v3 端点，可通过 DOUBAO_IMAGE_API_URL 覆盖
    this.endpoint = process.env.DOUBAO_IMAGE_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    this.apiKey = process.env.DOUBAO_API_KEY;
    this.model = process.env.DOUBAO_IMAGE_MODEL || 'doubao-seedream-4-0-250828';
    this.size = process.env.DOUBAO_IMAGE_SIZE || '1024x1024';
    this.stream = String(process.env.DOUBAO_IMAGE_STREAM || 'false').toLowerCase() === 'true';
  }

  /**
   * 生成产品场景融合预览图（豆包 SeeDream）
   *
   * 该方法调用豆包图片生成接口，基于提供的产品图、场景图及目标框位进行融合，返回预览结果。
   *
   * 参数说明:
   * - payload: ProductPreviewRequest 输入请求，包含产品图、场景图、目标框位、个性化提示等信息
   *
   * 返回值:
   * - Promise<ProductPreviewResult>: 返回包含请求标识、跟踪ID、状态、原始返回以及预览图URL或Base64的结构化结果
   *
   * 可能抛出的异常:
   * - Error: 当未配置接口地址或网络/鉴权错误导致请求失败时抛出
   */
  async generatePreview(payload: ProductPreviewRequest): Promise<ProductPreviewResult> {
    if (!this.endpoint) {
      throw new Error('未配置豆包图片生成接口地址（DOUBAO_IMAGE_API_URL）');
    }

    const promptSegments = [payload.productQuery];
    if (payload.personalization) {
      promptSegments.push(payload.personalization);
    }
    // 将目标框位也加入提示，便于在不支持 target_box 的端点上获得更接近的结果
    const box = payload.boundingBox;
    const prompt = `${promptSegments.join('，')}。将产品融合到参考场景图的指定框位（x=${box.x.toFixed(3)}, y=${box.y.toFixed(3)}, w=${box.width.toFixed(3)}, h=${box.height.toFixed(3)}），生成高清预览图。`;

    // Ark Doubao / OpenAI 风格 images.generations 请求体
    const requestBody: Record<string, any> = {
      model: this.model,
      prompt,
      size: this.size,
      stream: this.stream,
      response_format: 'url',
      watermark: true,
    };

    // 豆包 Ark v3 支持 image 数组与顺序生成选项
    const images: string[] = [];
    if (payload.sceneImage) images.push(normalizeDataUrl(payload.sceneImage));
    if (payload.productImage) images.push(normalizeDataUrl(payload.productImage));
    if (images.length > 0) {
      requestBody.image = images;
      requestBody.sequential_image_generation = 'auto';
      requestBody.sequential_image_generation_options = { max_images: 3 };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    // 明确声明响应体类型，避免在strict模式下被推断为{}
    const { data } = await axios.post<ProductPreviewApiResponse>(this.endpoint, requestBody, {
      headers,
      timeout: 60000,
    });

    const result: ProductPreviewResult = {};
    
    // 安全地添加可选属性
    const requestId = data?.requestId || data?.RequestId || data?.request_id;
    if (requestId !== undefined) {
      result.requestId = requestId;
    }
    
    const traceId = data?.traceId || data?.TraceId;
    if (traceId !== undefined) {
      result.traceId = traceId;
    }
    
    const status = data?.status || data?.Status;
    if (status !== undefined) {
      result.status = status;
    }
    
    result.raw = data as unknown as Record<string, unknown>;

    const urlCandidate =
      // Doubao/OpenAI 风格
      data?.data?.[0]?.url ||
      // 兼容其他服务
      data?.result?.url ||
      data?.result?.imageUrl ||
      data?.output?.results?.[0]?.url ||
      (data as any)?.data?.imageUrl ||
      (data as any)?.imageUrl ||
      data?.output?.image_url;

    if (typeof urlCandidate === 'string') {
      result.previewImage = urlCandidate;
    } else {
      const base64Candidate =
        // Doubao/OpenAI 风格
        data?.data?.[0]?.b64_json ||
        // 兼容其他服务
        data?.result?.imageBase64 ||
        data?.result?.image_base64 ||
        data?.output?.results?.[0]?.data ||
        (data as any)?.imageBase64 ||
        (data as any)?.image_base64;
      if (typeof base64Candidate === 'string' && base64Candidate.length > 50) {
        result.previewImage = normalizeDataUrl(base64Candidate);
      }
    }

    if (result.previewImage && !result.imageUrl) {
      result.imageUrl = result.previewImage;
    }

    return result;
  }
}
