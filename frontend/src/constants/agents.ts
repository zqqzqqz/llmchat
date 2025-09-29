import { Agent } from '@/types';

export const PRODUCT_PREVIEW_AGENT_ID = 'product-scene-preview';
export const VOICE_CALL_AGENT_ID = 'voice-conversation-assistant';

export const PRODUCT_PREVIEW_AGENT: Agent = {
  id: PRODUCT_PREVIEW_AGENT_ID,
  name: '产品现场预览',
  description: '拍摄现场环境，选择产品并填写个性化需求，生成沉浸式的现场预览图。',
  model: 'aliyun-image-generation',
  status: 'active',
  capabilities: ['现场拍照', '产品组合', '个性化生成'],
  provider: 'aliyun-vision',
};

export const VOICE_CALL_AGENT: Agent = {
  id: VOICE_CALL_AGENT_ID,
  name: '电话语音对话',
  description: '通过实时语音识别与语音播报，实现贴近电话体验的全双工对话。',
  model: 'fastgpt-voice-call',
  status: 'active',
  capabilities: ['语音识别', '实时对话', '语音播报'],
  provider: 'fastgpt',
};
