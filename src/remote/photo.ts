/**
 * Turns the camera's file into what the server may see: a JPEG no larger than
 * PHOTO_MAX_EDGE on its long side, re-encoded from pixels. Re-encoding through
 * a canvas carries no metadata across, so EXIF — GPS position, device, time —
 * never leaves the phone. The original file is not kept anywhere; only the
 * re-encoded bytes are handed to the caller, once.
 */

export const PHOTO_MAX_EDGE = 1280
const JPEG_QUALITY = 0.8

export interface PreparedPhoto {
  mimeType: 'image/jpeg'
  /** base64, no data: prefix */
  data: string
}

export class PhotoPrepareError extends Error {}

/** Scales (w, h) down to fit a max×max box, keeping the aspect ratio. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** True if the JPEG bytes carry an APP1 Exif or XMP segment before the image data. */
export function hasJpegMetadata(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false
  let i = 2
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!
    if (marker === 0xda) return false // start of scan: headers are over
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!
    if (marker === 0xe1) return true
    i += 2 + length
  }
  return false
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoPrepareError('not a readable image')
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoPrepareError('no canvas')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new PhotoPrepareError('encode failed')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (hasJpegMetadata(bytes)) throw new PhotoPrepareError('metadata survived re-encoding')
  return { mimeType: 'image/jpeg', data: toBase64(bytes) }
}
