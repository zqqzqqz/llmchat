import axios from 'axios';
import { ProductPreviewRequest, ProductPreviewResult } from '@/types';

const normalizeDataUrl = (image: string): string => {
  if (!image) return image;
  if (image.startsWith('data:')) return image;
  return `data:image/png;base64,${image}`;
};

export class ProductPreviewService {
  private endpoint: string;
  private apiKey: string | undefined;
  private model: string | undefined;
  private workspaceId: string | undefined;

  constructor() {
    this.endpoint = process.env.ALIYUN_IMAGE_API_URL || process.env.ALIYUN_DASHSCOPE_IMAGE_URL || '';
    this.apiKey = process.env.ALIYUN_IMAGE_API_KEY || process.env.ALIYUN_DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY;
    this.model = process.env.ALIYUN_IMAGE_MODEL || 'wanx-stylepro-v1';
    this.workspaceId = process.env.ALIYUN_WORKSPACE_ID;
  }

  async generatePreview(payload: ProductPreviewRequest): Promise<ProductPreviewResult> {
    if (!this.endpoint) {
      throw new Error('未配置阿里图片生成接口地址（ALIYUN_IMAGE_API_URL）');
    }

    const promptSegments = [payload.productQuery];
    if (payload.personalization) {
      promptSegments.push(payload.personalization);
    }
    const prompt = promptSegments.join('，');

    const requestBody: Record<string, any> = {
      model: this.model,
      input: {
        prompt,
        reference_image: normalizeDataUrl(payload.sceneImage),
        target_box: {
          x: Number(payload.boundingBox.x.toFixed(4)),
          y: Number(payload.boundingBox.y.toFixed(4)),
          width: Number(payload.boundingBox.width.toFixed(4)),
          height: Number(payload.boundingBox.height.toFixed(4)),
        },
      },
      parameters: {
        mode: 'PRODUCT_SCENE_FUSION',
      },
    };

    if (payload.productImage) {
      requestBody.input.product_image = normalizeDataUrl(payload.productImage);
    }

    if (this.workspaceId) {
      requestBody.workspace_id = this.workspaceId;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const { data } = await axios.post(this.endpoint, requestBody, {
      headers,
      timeout: 60000,
    });

    const result: ProductPreviewResult = {
      requestId: data?.requestId || data?.RequestId || data?.request_id,
      traceId: data?.traceId || data?.TraceId,
      status: data?.status || data?.Status,
      raw: data,
    };

    const urlCandidate =
      data?.result?.url ||
      data?.result?.imageUrl ||
      data?.output?.results?.[0]?.url ||
      data?.data?.imageUrl ||
      data?.imageUrl ||
      data?.output?.image_url;

    if (typeof urlCandidate === 'string') {
      result.previewImage = urlCandidate;
    } else {
      const base64Candidate =
        data?.result?.imageBase64 ||
        data?.result?.image_base64 ||
        data?.output?.results?.[0]?.data ||
        data?.imageBase64 ||
        data?.image_base64;
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
