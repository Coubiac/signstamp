/* Vite + TS: permettre `?url` pour le worker PDF.js */
declare module "*?url" {
  const src: string;
  export default src;
}
