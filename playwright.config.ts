import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置
 *
 * - 使用 webServer 在测试前启动后端开发服务（Windows 环境采用 npm --prefix 方式）
 * - 测试目录为 tests/e2e
 * - 基础 URL 指向后端服务 http://localhost:3001
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm --prefix backend run dev',
    url: 'http://localhost:3001/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});