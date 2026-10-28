// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Last300mPage } from './Last300mPage'
import { speechVolumeFor } from '../ui/volumeStore'

/**
 * The 幫我問 card speaks in the outdoor voice the person chose — the same
 * Leda or Puck that has been guiding them, never the device voice. 靜音 is
 * the person's choice for the whole page: someone who chose it may be
 * somewhere a phone must not speak. The card is shown to a passer-by, so it
 * still opens — silently. Closing the card stops the recording: the phone
 * must not talk over the person who is answering.
 */

const speak = vi.fn()
const fetched: string[] = []
const stopped = vi.fn()
const gains: Array<{ value: number }> = []
const started: Array<number | undefined> = [] // the gain each recording started at

beforeEach(() => {
  speak.mockReset()
  stopped.mockReset()
  fetched.length = 0
  gains.length = 0
  started.length = 0
  // A session start answers; recordings answer with bytes; route info fails.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetched.push(String(url))
    if (String(url).endsWith('.wav')) return new Response(new ArrayBuffer(8))
    if (!String(url).endsWith('/api/sessions')) throw new TypeError('offline')
    return Response.json({
      sessionId: 's1',
      session: { routeId: 'renai-001', state: 'AT_CHECKPOINT', checkpointId: 'cp1', questionCount: 0 },
      action: { type: 'GUIDE', checkpointId: 'cp1', instruction: 'walk on' },
    }, { status: 201 })
  }))
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    lang = ''
    rate = 1
    volume = 1
    constructor(public text: string) {}
  })
  vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() })
  vi.stubGlobal('Audio', class { volume = 1; play() { return Promise.resolve() } pause() {} })
  // A recording plays until stopped: it never ends by itself here.
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    destination = {}
    resume() { return Promise.resolve() }
    close() { return Promise.resolve() }
    decodeAudioData() { return Promise.resolve({}) }
    createGain() { const node = { gain: { value: 1 }, connect() {}, disconnect() {} }; gains.push(node.gain); return node }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { started.push(gains.slice(-1)[0]?.value) }, stop: stopped, onended: null } }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const helpRecordings = () => fetched.filter(url => url.includes('ask.help-entrance'))

it('says the help question in the chosen outdoor voice, stops it on close, and not at all when 靜音 is chosen', async () => {
  const user = userEvent.setup()
  render(<StrictMode><Last300mPage /></StrictMode>)
  await user.click(screen.getByRole('button', { name: '開始' }))

  await user.click(await screen.findByRole('button', { name: '幫我問' }))
  await waitFor(() => expect(helpRecordings().slice(-1)[0]).toMatch(/audio\/outdoor\/renai-001\/leda\/ask\.help-entrance\.wav$/))
  await waitFor(() => expect(stopped).toHaveBeenCalled()) // opening help stopped the route guidance
  stopped.mockClear()
  await user.click(screen.getByRole('button', { name: '好了' }))
  expect(stopped).toHaveBeenCalled()

  await user.selectOptions(screen.getByRole('combobox', { name: '聲音' }), 'Puck')
  await user.click(screen.getByRole('button', { name: '幫我問' }))
  await waitFor(() => expect(helpRecordings().slice(-1)[0]).toMatch(/\/puck\/ask\.help-entrance\.wav$/))
  await user.click(screen.getByRole('button', { name: '好了' }))

  fetched.length = 0
  await user.selectOptions(screen.getByRole('combobox', { name: '聲音' }), 'quiet')
  await user.click(screen.getByRole('button', { name: '幫我問' }))
  expect(screen.getByRole('dialog', { name: '請問，醫院的正門要怎麼走？' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '再說一遍' }))
  expect(helpRecordings()).toEqual([])
  expect(speak).not.toHaveBeenCalled()
})

it('plays the help question at the card volume, one step louder after 再說一遍', async () => {
  const user = userEvent.setup()
  render(<StrictMode><Last300mPage /></StrictMode>)
  await user.click(screen.getByRole('button', { name: '開始' }))
  await user.click(await screen.findByRole('button', { name: '幫我問' }))
  await waitFor(() => expect(helpRecordings()).not.toEqual([]))
  await waitFor(() => expect(started.slice(-1)[0]).toBe(speechVolumeFor('ask.utterance')))
  const before = speechVolumeFor('ask.utterance')

  await user.click(screen.getByRole('button', { name: '再說一遍' }))
  expect(speechVolumeFor('ask.utterance')).toBeGreaterThan(before)
  await waitFor(() => expect(started.slice(-1)[0]).toBe(speechVolumeFor('ask.utterance')))
})
