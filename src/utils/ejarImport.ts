import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { EjarImportData } from "@/data/types";
import { parseEjarContractText } from "@/utils/ejarParser";

pdfjsLib.GlobalWorkerOptions.workerSrc = "";

function timeoutPromise<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const STEP_TIMEOUT = 15000;

  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const pdf = await timeoutPromise(loadingTask.promise, STEP_TIMEOUT, "getDocument()");

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await timeoutPromise(pdf.getPage(pageNumber), STEP_TIMEOUT, `getPage(${pageNumber})`);
    const textContent = await timeoutPromise(page.getTextContent(), STEP_TIMEOUT, `getTextContent(${pageNumber})`);
    const lines: string[] = [];
    for (const item of (textContent.items as Array<{ str?: string }>)) {
      if (item.str?.trim()) lines.push(item.str.trim());
    }
    if (lines.length) pageTexts.push(lines.join("\n"));
  }
  return pageTexts.join("\n\n");
}

export async function importEjarContract(file: File): Promise<{ text: string; data: EjarImportData }> {
  console.log("[PDF Import] started", file?.name, file?.type, file?.size);

  if (!file || file.type !== "application/pdf") {
    return { text: "", data: createEmptyEjarData() };
  }

  try {
    const buffer = await file.arrayBuffer();
    console.log("[PDF Import] arrayBuffer size:", buffer.byteLength);
    const text = await extractPdfText(buffer);
    console.log("[PDF Import] extracted text length:", text.length);
    if (text.trim().length < 50) {
      return { text, data: createEmptyEjarData() };
    }
    const data = parseEjarContractText(text);
    return { text, data };
  } catch (error) {
    console.error("[PDF Import] failed:", error);
    return { text: "", data: createEmptyEjarData() };
  }
}

export function createEmptyEjarData(): EjarImportData {
  return {
    contract: { expiryReminderDays: 60, autoRenewal: false },
    tenant: {},
    lessor: {},
    broker: {},
    ownership: {},
    property: {},
    unit: {},
    financial: {},
    payments: [],
    warnings: [],
    reviewFields: [],
  };
}
