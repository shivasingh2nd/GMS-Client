// The CommonJS entry of tesseract.js loses its interop export in Angular's
// optimized build, so we import the prebuilt ESM bundle, which ships no types.
declare module 'tesseract.js/dist/tesseract.esm.min.js' {
  import type { Worker } from 'tesseract.js';

  const tesseract: {
    createWorker(langs?: string | string[]): Promise<Worker>;
  };

  export default tesseract;
}
