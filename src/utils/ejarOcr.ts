import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import tesseractWorkerUrl from "tesseract.js/dist/worker.min.js?url";
import tesseractCoreUrl from "tesseract.js-core/tesseract-core-lstm.wasm.js?url";
import arabicDataUrl from "@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function directoryOf(url: string): string {
  return url.slice(0, url.lastIndexOf("/"));
}

export async function extractArabicOcrText(buffer: ArrayBuffer, maxPages = 3): Promise<string> {
  const [{ createWorker }, pdf] = await Promise.all([
    import("tesseract.js"),
    pdfjsLib.getDocument({
      data: buffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise,
  ]);

  const worker = await createWorker("ara", 1, {
    workerPath: tesseractWorkerUrl,
    corePath: tesseractCoreUrl,
    langPath: directoryOf(arabicDataUrl),
    gzip: true,
    logger: (message) => console.log("[Ejar OCR]", message.status, message.progress),
  });

  const pageTexts: string[] = [];
  try {
    const pageCount = Math.min(maxPages, pdf.numPages);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) continue;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      if (result.data.text.trim()) pageTexts.push(result.data.text);
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }
  return pageTexts.join("\n\n");
}
