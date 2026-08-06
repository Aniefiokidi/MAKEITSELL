// Self-hosted OCR via Tesseract.js — reads text in a buyer's photo (e.g. a screenshot of
// a listing with a visible product name/price, or a flyer) as a fallback signal for
// photo-based product search when visual similarity alone finds nothing. Not an AI/vision
// API: Tesseract is a classical OCR engine that runs entirely in this process. Its English
// language training data is fetched once (from Tesseract.js's own project CDN) and cached
// for the life of the process — the same "fetch model data on first use" pattern already
// used for MobileNet's weights in lib/image-classify.ts, not a per-request network call.
import { createWorker, type Worker } from 'tesseract.js'
import os from 'os'

let workerPromise: Promise<Worker> | null = null

// cachePath must be explicitly writable — confirmed locally that Tesseract's default
// caching wrote eng.traineddata to the process's current working directory, which is
// fine on a dev machine but is READ-ONLY on Vercel's serverless filesystem (only the OS
// temp dir is writable there). os.tmpdir() resolves correctly on both: the system temp
// dir on Windows for local dev, /tmp on Vercel's Linux runtime — a hardcoded '/tmp' would
// silently fail on Windows, where that path doesn't exist. Same "clear the singleton on
// failure so the next call retries" pattern as lib/image-classify.ts's getModel — one
// transient failure shouldn't wedge OCR for the rest of the process's lifetime.
function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', undefined, { cachePath: os.tmpdir() }).catch((error) => {
      workerPromise = null
      throw error
    })
  }
  return workerPromise
}

// Returns cleaned text extracted from the image, or null if nothing legible was found.
// A plain length check isn't enough — confirmed live against a real (text-free) product
// photo: OCR read texture/edge noise as a long string of stray symbols and punctuation
// ("- Z \ SN —————— ; I VV SN, ..."), well past any reasonable minimum length. Filters on
// two signals instead: Tesseract's own recognition confidence (0-100, low for noise) and
// the fraction of the result that's actually alphanumeric (real text is dominated by
// letters/digits; noise skews toward symbols and dashes).
const MIN_CONFIDENCE = 60
const MIN_ALPHANUMERIC_RATIO = 0.5

export async function extractTextFromImage(buffer: Buffer): Promise<string | null> {
  try {
    const worker = await getWorker()
    const { data } = await worker.recognize(buffer)
    const text = String(data?.text || '').trim().replace(/\s+/g, ' ')
    if (text.length < 4) return null

    const confidence = Number(data?.confidence || 0)
    const alnumRatio = (text.match(/[a-zA-Z0-9]/g) || []).length / text.length
    if (confidence < MIN_CONFIDENCE || alnumRatio < MIN_ALPHANUMERIC_RATIO) return null

    return text.slice(0, 200)
  } catch (error) {
    console.error('[image-ocr] Failed to extract text from image:', error)
    return null
  }
}
