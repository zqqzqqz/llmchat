// 声明静态资源模块类型，允许在 TS/TSX 中 import 图片
declare module '*.png' {
  const src: string;
  export default src;
}

