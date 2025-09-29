import { ProductPreviewRequest, ProductPreviewResult } from '@/types';
export declare class ProductPreviewService {
    private endpoint;
    private apiKey;
    private model;
    private size;
    private stream;
    constructor();
    generatePreview(payload: ProductPreviewRequest): Promise<ProductPreviewResult>;
}
//# sourceMappingURL=ProductPreviewService.d.ts.map