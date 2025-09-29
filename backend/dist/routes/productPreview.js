"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productPreviewRoutes = void 0;
const express_1 = require("express");
const ProductPreviewController_1 = require("@/controllers/ProductPreviewController");
const router = (0, express_1.Router)();
const controller = new ProductPreviewController_1.ProductPreviewController();
router.post('/generate', controller.generatePreview);
exports.productPreviewRoutes = router;
//# sourceMappingURL=productPreview.js.map