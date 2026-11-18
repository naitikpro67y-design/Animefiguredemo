/// <reference types="vite/client" />

declare module '*.css' {
  const styles: Record<string, string>;
  export default styles;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}
