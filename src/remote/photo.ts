/**
 * Turns the camera's file into what the server may see: a JPEG no larger than
 * PHOTO_MAX_EDGE on its long side, re-encoded from pixels. The original file's
 * metadata is not copied. Some browsers add fresh metadata while encoding, so
 * that output is cleaned and checked before being handed to the caller.
 * The original file is not kept anywhere or returned for upload.
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

interface MetadataSegment { start: number; end: number }

/** Walk framing, including multiple scans; never interpret compressed pixels as headers. */
function jpegMetadataSegments(bytes: Uint8Array): MetadataSegment[] {
  const invalid = () => new PhotoPrepareError('invalid encoded JPEG')
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw invalid()
  const metadata: MetadataSegment[] = []
  let i = 2
  let inScan = false
  let sawScan = false
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      if (!inScan) throw invalid()
      i++
      continue
    }
    const start = i++
    while (bytes[i] === 0xff) i++ // legal fill bytes before a marker
    if (i >= bytes.length) throw invalid()
    const marker = bytes[i++]!
    if (inScan && (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))) {
      // Stuffed FF, standalone TEM and restart markers stay in the scan.
      continue
    }
    if (marker === 0xd9) {
      if (!sawScan || i !== bytes.length) throw invalid()
      return metadata
    }
    if (marker === 0x01) continue // TEM has no length field
    if (marker < 0xc0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw invalid()
    if (i + 2 > bytes.length) throw invalid()
    const length = (bytes[i]! << 8) | bytes[i + 1]!
    const end = i + length
    if (length < 2 || end > bytes.length) throw invalid()
    if (marker === 0xda) {
      const components = bytes[i + 2]!
      if (components < 1 || components > 4 || length !== 6 + components * 2) throw invalid()
      sawScan = true
    }
    if (marker === 0xdc && length !== 4) throw invalid()
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) metadata.push({ start, end })
    // DNL may define the height inside an entropy-coded scan without ending it.
    inScan = marker === 0xda || (inScan && marker === 0xdc)
    i = end
  }
  throw invalid() // missing end-of-image marker
}

/** True for EXIF/XMP, IPTC or comments; malformed framing also fails closed. */
export function hasJpegMetadata(bytes: Uint8Array): boolean {
  try {
    return jpegMetadataSegments(bytes).length > 0
  } catch {
    return true
  }
}

/** Removes private metadata from a JPEG freshly encoded by our canvas. */
export function stripCanvasJpegMetadata(bytes: Uint8Array): Uint8Array {
  const metadata = jpegMetadataSegments(bytes)
  const output = new Uint8Array(bytes.length - metadata.reduce((total, segment) => total + segment.end - segment.start, 0))
  let source = 0
  let target = 0
  for (const segment of metadata) {
    output.set(bytes.subarray(source, segment.start), target)
    target += segment.start - source
    source = segment.end
  }
  output.set(bytes.subarray(source), target)
  return output
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
  // Clean only the newly encoded pixels, never the camera's original file.
  const bytes = stripCanvasJpegMetadata(new Uint8Array(await blob.arrayBuffer()))
  if (hasJpegMetadata(bytes)) throw new PhotoPrepareError('metadata survived re-encoding')
  return { mimeType: 'image/jpeg', data: toBase64(bytes) }
}
