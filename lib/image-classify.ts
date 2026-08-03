// Self-hosted image classification + embeddings via a pretrained MobileNet running
// locally through TensorFlow.js (pure-JS/CPU backend — no native binaries, no external
// AI/vision API call at inference time). Model WEIGHTS are fetched once from Google's
// public TFHub storage on cold start and cached for the life of the process; nothing
// about a buyer's or vendor's photo is ever sent to a third party — every inference runs
// in our own process.
//
// Two separate forward passes, deliberately NOT both run unconditionally:
// 1. computeEmbeddingFromBuffer — a 1280-dim embedding vector (MobileNetV2's
//    pre-classification feature layer), used for cosine-similarity ranking (both the k-NN
//    category vote below and "similar, not identical" product ranking) — this is what
//    generalizes across different photos of a similar item, unlike dHash. Computed for
//    every image.
// 2. classifyImageNetFromBuffer — a broad "visual category" mapped from MobileNet's 1000
//    generic ImageNet labels (see CATEGORY_KEYWORD_RULES below). Only a FALLBACK signal
//    now: the PRIMARY category signal is k-NN against the catalog's own vendor-entered
//    categories using the embedding above (lib/product-image-analysis.ts's
//    resolveVisualCategoryForEmbedding), which measurably outperforms this generic keyword
//    mapping for products ImageNet has no good class for (perfume bottles, hair-care
//    items). Since k-NN succeeds for the large majority of products, this second forward
//    pass is only paid for on the rare product it doesn't — see that file.
//
// Model choice: v2/alpha 1.0 (larger, better accuracy) — measured ~10-15s/image on this
// pure-JS CPU backend (no native bindings, chosen to avoid Vercel native-binary risk).
// Slower than the smaller v1/alpha 0.5 variant (~3-5s/image) tried first, but classification
// always runs via next/server's after() (see lib/whatsapp/image-search.ts) rather than
// blocking a synchronous response, so the extra latency is a background-processing cost,
// not a user-facing one — same pattern already used for outbound WhatsApp notifications
// elsewhere in this codebase.
import * as tf from '@tensorflow/tfjs'
import * as mobilenetLib from '@tensorflow-models/mobilenet'
import sharp from 'sharp'

const IMAGE_SIZE = 224

let modelPromise: Promise<mobilenetLib.MobileNet> | null = null

function getModel(): Promise<mobilenetLib.MobileNet> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await tf.setBackend('cpu')
      await tf.ready()
      return mobilenetLib.load({ version: 2, alpha: 1.0 })
    })()
  }
  return modelPromise
}

// Index ranges/keyword rules against MobileNet's real IMAGENET_CLASSES label strings
// (node_modules/@tensorflow-models/mobilenet/dist/imagenet_classes.js) — built from the
// actual shipped label list, not guessed. ImageNet has no single clean "clothing" class
// group, so most buckets are a keyword match against known label substrings; food is a
// contiguous index range (923-969) and matched separately, more reliably, below.
const CATEGORY_KEYWORD_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'clothing',
    keywords: [
      'gown', 'robe', 'apron', 'bikini', 'brassiere', 'bra,', 'cardigan', 'coat',
      'jean,', 'jersey', 'kimono', 'lab coat', 'maillot', 'miniskirt', 'overskirt',
      'skirt', 'suit,', 'sweatshirt', 'sweater', 'trench coat', 'poncho', 'pajama',
      'vestment', 'abaya', 'diaper', 'swimming trunks',
    ],
  },
  {
    category: 'footwear',
    keywords: ['shoe', 'sandal', 'boot', 'sneaker', 'sock,', 'clog'],
  },
  {
    category: 'bags-accessories',
    keywords: [
      'backpack', 'purse', 'wallet', 'umbrella', 'sunglass', 'necklace', 'bow tie',
      'bolo tie', 'mailbag', 'handbag', 'bracelet', 'stopwatch', 'hat,', 'cap,',
      'hair slide',
    ],
  },
  {
    category: 'beauty-personal-care',
    keywords: ['face powder', 'hair spray', 'lipstick', 'lotion', 'perfume', 'sunscreen'],
  },
  {
    category: 'electronics',
    keywords: [
      'cellular telephone', 'cellphone', 'laptop', 'notebook, notebook computer',
      'desktop computer', 'hand-held computer', 'ipod', 'joystick', 'modem', 'monitor',
      'printer', 'radio,', 'remote control', 'television', 'tape player', 'cd player',
      'hard disc', 'camera', 'screen,', 'tripod', 'electric guitar',
    ],
  },
  {
    category: 'furniture-home',
    keywords: [
      'chair', 'couch', 'sofa', 'table,', 'wardrobe', 'bookcase', 'cradle', 'crib,',
      'four-poster', 'medicine chest', 'dining table', 'studio couch',
    ],
  },
  {
    category: 'automotive',
    keywords: [
      'sports car', 'convertible', 'jeep', 'minivan', 'pickup', 'limousine',
      'golfcart', 'moped', 'motor scooter', 'racer, race car', 'car wheel',
      'car mirror', 'beach wagon', 'cab, hack, taxi', 'police van', 'snowplow',
    ],
  },
  {
    category: 'toys-kids',
    keywords: ['teddy', 'balloon', 'jigsaw puzzle', 'rubber eraser'],
  },
  // ImageNet's contiguous food/dish/produce block (indices 923 'plate' through 969
  // 'eggnog', confirmed against the package's own imagenet_classes.js) has no shared
  // substring across the block, so it's listed explicitly rather than matched by index —
  // the package doesn't publicly export the label list to look indices up against.
  {
    category: 'food',
    keywords: [
      'guacamole', 'consomme', 'hot pot', 'trifle', 'ice cream', 'ice lolly',
      'french loaf', 'bagel', 'pretzel', 'cheeseburger', 'hotdog', 'mashed potato',
      'head cabbage', 'broccoli', 'cauliflower', 'zucchini', 'spaghetti squash',
      'acorn squash', 'butternut squash', 'cucumber', 'artichoke', 'bell pepper',
      'cardoon', 'mushroom', 'granny smith', 'strawberry', 'orange', 'lemon', 'fig',
      'pineapple', 'banana', 'jackfruit', 'custard apple', 'pomegranate', 'carbonara',
      'chocolate sauce', 'dough', 'meat loaf', 'pizza', 'potpie', 'burrito',
      'red wine', 'espresso', 'eggnog', 'plate',
    ],
  },
]

// Tried checking all top-K predictions (not just #1) so a correct-but-lower-ranked label
// could still match — measured against real catalog photos, this made results WORSE, not
// better: in the cases that motivated it, a WRONG label was already matching a keyword at
// #1 (e.g. "studio couch" already hits the 'couch' keyword before "purse" at #4 is ever
// reached), so checking deeper ranks mostly added new false-positive matches elsewhere
// (an iPhone photo's #3-5 labels happened to hit 'blush'; hair-braid products matched
// food/electronics keywords by coincidence) rather than rescuing the cases it targeted.
// Reverted to top-1-only, which measurably had fewer false positives despite lower
// coverage — coverage gap is handled by the graceful fallback in image-search.ts (rank
// the whole catalog by embedding similarity when there's no confident category).
function resolveVisualCategory(predictions: Array<{ className: string; probability: number }>): { category: string | null; confidence: number } {
  const top = predictions[0]
  if (top) {
    const lowerLabel = top.className.toLowerCase()
    for (const rule of CATEGORY_KEYWORD_RULES) {
      if (rule.keywords.some((kw) => lowerLabel.includes(kw))) {
        return { category: rule.category, confidence: top.probability }
      }
    }
  }

  return { category: null, confidence: predictions[0]?.probability || 0 }
}

async function decodeToTensor(buffer: Buffer): Promise<tf.Tensor3D> {
  const { data } = await sharp(buffer)
    .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'fill' })
    .removeAlpha()
    .toFormat('raw')
    .toBuffer({ resolveWithObject: true })
  return tf.tensor3d(new Uint8Array(data), [IMAGE_SIZE, IMAGE_SIZE, 3], 'int32')
}

// The embedding alone (one forward pass) — this is what k-NN category voting and
// similarity ranking both run on. Split out from classifyImageNetFromBuffer below so a
// caller whose k-NN vote already succeeds never pays for the second (ImageNet-label)
// forward pass at all — see product-image-analysis.ts's resolveVisualCategoryForEmbedding,
// which only calls classifyImageNetFromBuffer as a fallback when k-NN has no confident
// answer. Roughly halves compute for the common case where k-NN alone is enough.
export async function computeEmbeddingFromBuffer(buffer: Buffer): Promise<number[] | null> {
  let tensor: tf.Tensor3D | null = null
  try {
    tensor = await decodeToTensor(buffer)
    const model = await getModel()
    const embeddingTensor = model.infer(tensor, true)
    const embedding = Array.from(await embeddingTensor.data())
    embeddingTensor.dispose()
    return embedding
  } catch (error) {
    console.error('[image-classify] Failed to compute embedding:', error)
    return null
  } finally {
    tensor?.dispose()
  }
}

export interface ImageNetClassification {
  visualCategory: string | null
  categoryConfidence: number
  topLabel: string
}

// The generic ImageNet-label fallback (a second forward pass) — see the module comment
// and product-image-analysis.ts for why this is only invoked when k-NN isn't confident,
// not unconditionally alongside the embedding above.
export async function classifyImageNetFromBuffer(buffer: Buffer): Promise<ImageNetClassification | null> {
  let tensor: tf.Tensor3D | null = null
  try {
    tensor = await decodeToTensor(buffer)
    const model = await getModel()
    const predictions = await model.classify(tensor, 5)
    const { category, confidence } = resolveVisualCategory(predictions)
    return { visualCategory: category, categoryConfidence: confidence, topLabel: predictions[0]?.className || '' }
  } catch (error) {
    console.error('[image-classify] Failed to classify image:', error)
    return null
  } finally {
    tensor?.dispose()
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return -1
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return -1
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
