import { afterEach, describe, expect, it, vi } from 'vitest'
import { PhotoPrepareError, preparePhoto, stripCanvasJpegMetadata } from './photo'
import { photoDiagnostic } from './photoDiagnostic'

describe('local-only photo failure diagnostic', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('distinguishes unreadable JPEG framing from decoding failure', () => {
    let failure: unknown
    try { stripCanvasJpegMetadata(new Uint8Array([255, 216, 255])) } catch (e) { failure = e }
    expect(failure).toBeInstanceOf(PhotoPrepareError)
    expect((failure as PhotoPrepareError).code).toBe('P-JPEG')
  })

  it('reports bounded stage and header format without filename or image contents', async () => {
    const file = new Blob([new Uint8Array([255, 216, 255, 224]), 'PRIVATE_FILENAME_GPS'], { type: 'image/jpeg' })
    const diagnostic = await photoDiagnostic(new PhotoPrepareError('private exception /secret/photo.jpg', 'P-DECODE', 'InvalidStateError'), file)
    expect(diagnostic).toContain('P-DECODE')
    expect(diagnostic).toContain('JPEG')
    expect(diagnostic).toContain('InvalidStateError')
    expect(diagnostic).not.toMatch(/PRIVATE|secret|GPS|photo.jpg/)
  })

  it('identifies a HEIF header even when the MIME type is misleading', async () => {
    const file = new Blob([new Uint8Array([0, 0, 0, 24]), 'ftypheic'], { type: 'image/jpeg' })
    expect(await photoDiagnostic(new PhotoPrepareError('decode', 'P-DECODE'), file)).toContain('HEIF')
  })

  it('reports AVIF when its compatible brands also contain generic mif1', async () => {
    const file = new Blob([new Uint8Array([0, 0, 0, 24]), 'ftypavif', new Uint8Array(4), 'mif1avif'])
    expect(await photoDiagnostic(new PhotoPrepareError('decode', 'P-DECODE'), file)).toContain('AVIF')
  })

  it('retains the native decoder name even when its exception is not an Error subclass', async () => {
    vi.stubGlobal('createImageBitmap', async () => { throw { name: 'InvalidStateError', message: 'PRIVATE_CAUSE' } })
    await expect(preparePhoto(new Blob(['bad']))).rejects.toMatchObject({ code: 'P-DECODE', causeName: 'InvalidStateError' })
  })

  it('does not echo arbitrary MIME values or exception names', async () => {
    const file = new Blob(['private bytes'], { type: 'private/filename' })
    const diagnostic = await photoDiagnostic(new PhotoPrepareError('private', 'P-DECODE', 'private-cause'), file)
    expect(diagnostic).toContain('OTHER')
    expect(diagnostic).not.toContain('private')
  })
});
