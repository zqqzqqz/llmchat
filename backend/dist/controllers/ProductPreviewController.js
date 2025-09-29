"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductPreviewController = void 0;
const joi_1 = __importDefault(require("joi"));
const ProductPreviewService_1 = require("@/services/ProductPreviewService");
class ProductPreviewController {
    constructor() {
        this.generateSchema = joi_1.default.object({
            sceneImage: joi_1.default.string().min(10).required().messages({
                'any.required': '现场照片不能为空',
                'string.empty': '现场照片不能为空',
            }),
            productImage: joi_1.default.string().min(10).optional().allow('', null),
            productQuery: joi_1.default.string().min(1).required().messages({
                'any.required': '产品查询不能为空',
                'string.empty': '产品查询不能为空',
            }),
            personalization: joi_1.default.string().allow('', null).optional(),
            boundingBox: joi_1.default.object({
                x: joi_1.default.number().min(0).max(1).required(),
                y: joi_1.default.number().min(0).max(1).required(),
                width: joi_1.default.number().min(0).max(1).required(),
                height: joi_1.default.number().min(0).max(1).required(),
            }).required().messages({
                'any.required': '请标记现场红框区域',
            }),
        });
        this.generatePreview = async (req, res) => {
            const { error, value } = this.generateSchema.validate(req.body, { abortEarly: false, allowUnknown: false });
            if (error) {
                const apiError = {
                    code: 'VALIDATION_ERROR',
                    message: error.details.map((detail) => detail.message).join('；'),
                    timestamp: new Date().toISOString(),
                };
                res.status(400).json(apiError);
                return;
            }
            try {
                const result = await this.service.generatePreview(value);
                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (err) {
                console.error('调用豆包图片生成接口失败:', err);
                const apiError = {
                    code: 'DOUBAO_IMAGE_GENERATE_FAILED',
                    message: err?.response?.data?.message || err?.message || '生成现场预览失败',
                    timestamp: new Date().toISOString(),
                    details: process.env.NODE_ENV === 'development' ? err?.response?.data || err : undefined,
                };
                res.status(500).json(apiError);
            }
        };
        this.service = new ProductPreviewService_1.ProductPreviewService();
    }
}
exports.ProductPreviewController = ProductPreviewController;
//# sourceMappingURL=ProductPreviewController.js.map