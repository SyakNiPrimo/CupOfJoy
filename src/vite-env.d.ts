/// <reference types="vite/client" />

declare module 'qrcode' {
  export function toDataURL(
    text: string,
    options?: {
      width?: number;
      margin?: number;
      [key: string]: unknown;
    },
  ): Promise<string>;
}
