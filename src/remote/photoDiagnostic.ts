import type { PhotoPrepareError } from './photo'

const CAUSES = new Set(['none', 'Error', 'TypeError', 'ReferenceError', 'InvalidStateError', 'NotSupportedError', 'EncodingError', 'SecurityError', 'NotReadableError', 'AbortError'])

/** Fixed vocabulary only: never return filenames, exception messages, EXIF or photo bytes. */
export async function photoDiagnostic(error: PhotoPrepareError, file: Blob): Promise<string> {
  let format = 'OTHER'
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const header = await Promise.race([
      file.slice(0, 32).arrayBuffer(),
      new Promise<ArrayBuffer>((_, reject) => { timeout = setTimeout(() => reject(new Error('header timeout')), 1000) }),
    ])
    const bytes = new Uint8Array(header)
    const signature = String.fromCharCode(...bytes)
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) format = 'JPEG'
    else if (signature.startsWith('\x89PNG\r\n\x1a\n')) format = 'PNG'
    else if (signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP') format = 'WEBP'
    else if (signature.slice(4, 8) === 'ftyp') {
      const brands = signature.slice(8)
      if (/(?:avif|avis)/.test(brands)) format = 'AVIF'
      else if (/(?:heic|heix|hevc|hevx|mif1|msf1)/.test(brands)) format = 'HEIF'
    }
  } catch {
    format = 'UNREADABLE'
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
  const cause = CAUSES.has(error.causeName) ? error.causeName : 'OTHER'
  return `${error.code} / ${format} / ${Math.ceil(file.size / 1024)}K / ${cause} / B${typeof createImageBitmap === 'function' ? 1 : 0}`
}
