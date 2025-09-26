import fs from 'fs/promises';
import path from 'path';

/**
 * 读取带注释的 JSONC 配置文件并解析为对象
 */
export async function readJsonc<T = any>(configRelativePath: string): Promise<T> {
  const fullPath = path.isAbsolute(configRelativePath)
    ? configRelativePath
    : path.join(__dirname, '../../../', configRelativePath);
  const raw = await fs.readFile(fullPath, 'utf-8');
  const stripped = stripJsonComments(raw);
  return JSON.parse(stripped) as T;
}

/**
 * 简单去除 // 和 /* *\/ 样式注释
 * 注意：该实现针对配置文件足够，勿用于复杂 JS 代码解析
 */
export function stripJsonComments(input: string): string {
  // 去除多行注释 /* ... */
  let output = input.replace(/\/\*[\s\S]*?\*\//g, '');
  // 去除单行注释 //...
  output = output.replace(/^\s*\/\/.*$/gm, '');
  return output;
}

