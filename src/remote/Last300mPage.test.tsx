// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Last300mPage } from './Last300mPage'

/**
 * 靜音 is the person's choice for the whole outdoor page: someone who chose it
 * may be somewhere a phone must not speak. The 幫我問 card is shown to a
 * passer-by, so it still opens — silently.
 */

const speak = vi.fn()

beforeEach(() => {
  speak.mockReset()
  // Only a session start answers; route info fails and the page shows no rows.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
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
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('says the help question aloud in a voice, and not at all when 靜音 is chosen', async () => {
  const user = userEvent.setup()
  render(<StrictMode><Last300mPage /></StrictMode>)
  await user.click(screen.getByRole('button', { name: '開始' }))

  await user.click(await screen.findByRole('button', { name: '幫我問' }))
  expect(speak).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '好了' }))

  speak.mockReset()
  await user.selectOptions(screen.getByRole('combobox', { name: '聲音' }), 'quiet')
  await user.click(screen.getByRole('button', { name: '幫我問' }))
  expect(screen.getByRole('dialog', { name: '請問，醫院的正門要怎麼走？' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '再說一遍' }))
  expect(speak).not.toHaveBeenCalled()
})
