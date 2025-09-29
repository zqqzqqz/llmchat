import { Router } from 'express';
import { ProductPreviewController } from '@/controllers/ProductPreviewController';

const router = Router();
const controller = new ProductPreviewController();

router.post('/generate', controller.generatePreview);

export const productPreviewRoutes = router;
