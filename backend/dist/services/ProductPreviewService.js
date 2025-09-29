"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductPreviewService = void 0;
const axios_1 = __importDefault(require("axios"));
const normalizeDataUrl = (image) => {
    if (!image)
        return image;
    if (image.startsWith('data:'))
        return image;
    return `data:image/png;base64,${image}`;
};
class ProductPreviewService {
    constructor() {
        this.endpoint = process.env.DOUBAO_IMAGE_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
        this.apiKey = process.env.DOUBAO_API_KEY;
        this.model = process.env.DOUBAO_IMAGE_MODEL || 'doubao-seedream-4-0-250828';
        this.size = process.env.DOUBAO_IMAGE_SIZE || '1024x1024';
        this.stream = String(process.env.DOUBAO_IMAGE_STREAM || 'false').toLowerCase() === 'true';
    }
    async generatePreview(payload) {
        if (!this.endpoint) {
            throw new Error('未配置豆包图片生成接口地址（DOUBAO_IMAGE_API_URL）');
        }
        const promptSegments = [payload.productQuery];
        if (payload.personalization) {
            promptSegments.push(payload.personalization);
        }
        const box = payload.boundingBox;
        const prompt = `${promptSegments.join('，')}。将产品融合到参考场景图的指定框位（x=${box.x.toFixed(3)}, y=${box.y.toFixed(3)}, w=${box.width.toFixed(3)}, h=${box.height.toFixed(3)}），生成高清预览图。`;
        const requestBody = {
            model: this.model,
            prompt,
            size: this.size,
            stream: this.stream,
            response_format: 'url',
            watermark: true,
        };
        const images = [];
        if (payload.sceneImage)
            images.push(normalizeDataUrl(payload.sceneImage));
        if (payload.productImage)
            images.push(normalizeDataUrl(payload.productImage));
        if (images.length > 0) {
            requestBody.image = images;
            requestBody.sequential_image_generation = 'auto';
            requestBody.sequential_image_generation_options = { max_images: 3 };
        }
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const { data } = await axios_1.default.post(this.endpoint, requestBody, {
            headers,
            timeout: 60000,
        });
        const result = {};
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
        result.raw = data;
        const urlCandidate = data?.data?.[0]?.url ||
            data?.result?.url ||
            data?.result?.imageUrl ||
            data?.output?.results?.[0]?.url ||
            data?.data?.imageUrl ||
            data?.imageUrl ||
            data?.output?.image_url;
        if (typeof urlCandidate === 'string') {
            result.previewImage = urlCandidate;
        }
        else {
            const base64Candidate = data?.data?.[0]?.b64_json ||
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
exports.ProductPreviewService = ProductPreviewService;
//# sourceMappingURL=ProductPreviewService.js.map