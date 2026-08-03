// Self-hosted perceptual image hashing (dHash) — no AI/vision API involved, per explicit
// product decision. Good at recognizing near-duplicate images (a buyer forwarding a saved
// product photo, a screenshot of a listing, a recompressed copy of the same picture); NOT
// object recognition — a different photo of a similar-but-not-identical item will usually
// score as a poor match, since dHash compares pixel-gradient structure, not semantics.
import sharp from 'sharp'

// dHash: shrink to 9x8 grayscale, compare each pixel to its right neighbor (8 rows x 8
// comparisons = 64 bits), encode as a 16-char hex string. Stable under recompression/
// resizing, sensitive to composition/crop/rotation.
const HASH_WIDTH = 9
const HASH_HEIGHT = 8

export async function computeImageHashFromBuffer(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    let bits = ''
    for (let row = 0; row < HASH_HEIGHT; row++) {
      for (let col = 0; col < HASH_WIDTH - 1; col++) {
        const left = data[row * HASH_WIDTH + col]
        const right = data[row * HASH_WIDTH + col + 1]
        bits += left > right ? '1' : '0'
      }
    }

    // 64 bits -> 16 hex chars, 4 bits at a time.
    let hex = ''
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
    }
    return hex
  } catch (error) {
    console.error('[image-hash] Failed to compute hash from buffer:', error)
    return null
  }
}

export async function computeImageHashFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[image-hash] Failed to fetch image for hashing: ${url} (${res.status})`)
      return null
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    return computeImageHashFromBuffer(buffer)
  } catch (error) {
    console.error(`[image-hash] Failed to fetch/hash image: ${url}`, error)
    return null
  }
}

export function hammingDistance(hashA: string, hashB: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) return Infinity
  let distance = 0
  for (let i = 0; i < hashA.length; i++) {
    const diff = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16)
    // Count set bits in this nibble's XOR.
    distance += [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4][diff]
  }
  return distance
}
