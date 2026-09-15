import type { Worker } from 'tesseract.js';

let sharedWorker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (sharedWorker) return sharedWorker;
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      sharedWorker = worker;
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Run browser-side OCR on an image file and return plain text. */
export async function recognizeImageText(file: Blob): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(file);
  return data.text || '';
}
