// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DestinationAnswer } from '../destination/client'
import { loadVisit, MemoryStorage } from '../persistence/visitStore'
import { App } from './App'

// Node may expose an unavailable native localStorage. App imports must see
// the same no-storage fallback on every Node version; each test gets its own.
vi.hoisted(() => { vi.stubGlobal('localStorage', undefined) })

const PHARMACY: DestinationAnswer = { mode: 'nemotron', destination: { kind: 'place', placeId: 'PHARMACY' } }
const CASHIER: DestinationAnswer = { mode: 'nemotron', destination: { kind: 'place', placeId: 'CASHIER' } }
const REGISTRATION: DestinationAnswer = { mode: 'nemotron', destination: { kind: 'place', placeId: 'REGISTRATION' } }

// Control the network boundary, keeping the real client, App, hook and engine.
function pendingReply() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => { resolve = done })
  return {
    promise,
    async reply(answer: DestinationAnswer) {
      await act(async () => { resolve(Response.json(answer)) })
    },
  }
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  // Animation is tested separately; do not run frames outside React's act.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 0))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup() {
  const user = userEvent.setup()
  const view = render(<StrictMode><App /></StrictMode>)
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: '想去哪裡' })
  const find = screen.getByRole<HTMLButtonElement>('button', { name: '找路' })
  return {
    ...view,
    user,
    input,
    find,
    async enter(text: string) {
      await user.clear(input)
      await user.type(input, text)
    },
    async reset() {
      await user.click(screen.getByText('dev panel'))
      await user.click(screen.getByRole('button', { name: 'reset visit' }))
    },
  }
}

describe('indoor destination confirmation', () => {
  it('removes the old confirmation as soon as the input changes, before submitting again', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await pending.reply(PHARMACY)
    expect(screen.getByRole('button', { name: '對' })).toBeTruthy()

    await ui.enter('批價')
    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(screen.queryByText(/要去藥局/)).toBeNull()
    expect(loadVisit()).toBeNull()
  })

  it('clears an old answer when resubmitting the same text and waits for the new answer', async () => {
    const first = pendingReply()
    const second = pendingReply()
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await first.reply(PHARMACY)
    await ui.user.click(ui.find)

    expect(ui.find.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(loadVisit()).toBeNull()
    await second.reply(PHARMACY)
    await ui.user.click(screen.getByRole('button', { name: '對' }))
    expect(loadVisit()?.legIndex).toBe(2)
  })

  it('lets a new input be submitted while an obsolete request is pending and only confirms the new destination', async () => {
    const old = pendingReply()
    const current = pendingReply()
    fetchMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await ui.enter('批價')
    expect(ui.find.disabled).toBe(false)
    await ui.user.click(ui.find)
    await current.reply(CASHIER)
    await old.reply(PHARMACY)

    expect(screen.getByText(/要去批價櫃台/)).toBeTruthy()
    expect(screen.queryByText(/要去藥局/)).toBeNull()
    expect(loadVisit()).toBeNull()
    await ui.user.click(screen.getByRole('button', { name: '對' }))
    expect(loadVisit()?.legIndex).toBe(1)
  })

  it('does not let an obsolete reply end the newer request loading state', async () => {
    const old = pendingReply()
    const current = pendingReply()
    fetchMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await ui.enter('批價')
    await ui.user.click(ui.find)
    await old.reply(PHARMACY)

    expect(ui.find.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    await current.reply(CASHIER)
    expect(ui.find.disabled).toBe(false)
    expect(screen.getByText(/要去批價櫃台/)).toBeTruthy()
  })

  it('keeps an old reply invalid even when the input is changed back to the same text', async () => {
    const old = pendingReply()
    fetchMock.mockReturnValueOnce(old.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await ui.enter('批價')
    await ui.enter('藥局')
    await old.reply(PHARMACY)

    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(ui.find.disabled).toBe(false)
    expect(loadVisit()).toBeNull()
  })

  it('rejects the current destination, restores input focus and ignores an older pending reply', async () => {
    const old = pendingReply()
    const current = pendingReply()
    fetchMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await ui.enter('批價')
    await ui.user.click(ui.find)
    await current.reply(CASHIER)
    await ui.user.click(screen.getByRole('button', { name: '不是' }))
    await old.reply(PHARMACY)

    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(ui.input.value).toBe('批價')
    expect(document.activeElement).toBe(ui.input)
    expect(loadVisit()).toBeNull()
  })

  it('resets a completed answer as well as the input', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await pending.reply(PHARMACY)
    await ui.reset()

    expect(ui.input.value).toBe('')
    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(loadVisit()).toBeNull()
  })

  it('resets a pending request and ignores its reply after a new query', async () => {
    const old = pendingReply()
    const current = pendingReply()
    fetchMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await ui.reset()
    expect(ui.input.value).toBe('')
    await ui.enter('批價')
    expect(ui.find.disabled).toBe(false)
    await ui.user.click(ui.find)
    await current.reply(CASHIER)
    await old.reply(PHARMACY)

    expect(screen.getByText(/要去批價櫃台/)).toBeTruthy()
    expect(screen.queryByText(/要去藥局/)).toBeNull()
    expect(loadVisit()).toBeNull()
  })

  it('does not bring a pending result back after starting and resetting the demo visit', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    expect(screen.queryByRole('button', { name: /開始/ })).toBeNull()
    await ui.user.clear(ui.input)
    await ui.user.click(screen.getByRole('button', { name: '開始示範行程' }))
    await pending.reply(PHARMACY)
    await ui.reset()

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: '想去哪裡' }).value).toBe('')
    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(loadVisit()).toBeNull()
  })

  it('keeps obsolete replies out of an ask card and the input after it closes', async () => {
    const old = pendingReply()
    const current = pendingReply()
    fetchMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await ui.enter('掛號')
    await ui.user.click(ui.find)
    await current.reply(REGISTRATION)
    await ui.user.click(screen.getByRole('button', { name: '對' }))
    expect(screen.getByRole('dialog', { name: '請問，掛號櫃台？' })).toBeTruthy()
    await old.reply(PHARMACY)
    await ui.user.click(screen.getByRole('button', { name: '好了' }))

    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(document.activeElement).toBe(ui.input)
    expect(loadVisit()).toBeNull()
  })

  it.each(['pending', 'answered'] as const)('invalidates a %s query when the bird long press opens generic help before confirmation', async (status) => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    if (status === 'answered') {
      await pending.reply(PHARMACY)
      expect(screen.getByRole('button', { name: '對' })).toBeTruthy()
    }
    await ui.user.click(screen.getByText('dev panel'))
    await ui.user.click(screen.getByRole('button', { name: 'simulate long press' }))
    expect(screen.getByRole('dialog', { name: '請問，可以幫我找路嗎？' })).toBeTruthy()
    if (status === 'pending') await pending.reply(PHARMACY)
    await ui.user.click(screen.getByRole('button', { name: '好了' }))

    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(ui.find.disabled).toBe(false)
    expect(document.activeElement).toBe(ui.input)
    expect(loadVisit()).toBeNull()
  })
})

describe('asking for help without a destination', () => {
  it.each(['nemotron', 'mock'] as const)('offers generic help for an uncertain %s answer without starting a visit', async (mode) => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    const originalText = '今天天氣如何'
    await ui.enter(originalText)
    await ui.user.click(ui.find)
    await pending.reply({ mode, destination: { kind: 'uncertain' } })

    expect(screen.getByText(/我不確定。我陪你問。/)).toBeTruthy()
    expect(screen.getByText(mode === 'mock' ? '模擬' : 'Nemotron')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /開始/ })).toBeNull()
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))
    const card = screen.getByRole('dialog', { name: '請問，可以幫我找路嗎？' })
    expect(document.activeElement).toBe(card)
    expect(card.textContent).not.toContain('神經外科')
    expect(card.textContent).not.toContain(originalText)
    expect(loadVisit()).toBeNull()

    await ui.user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(ui.input.value).toBe(originalText)
    expect(document.activeElement).toBe(ui.input)
    expect(screen.queryByRole('button', { name: /開始/ })).toBeNull()
    expect(loadVisit()).toBeNull()
  })

  it('returns a rejected destination to editing and offers generic help without opening it automatically', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await pending.reply(PHARMACY)
    await ui.user.click(screen.getByRole('button', { name: '不是' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(ui.input)
    expect(screen.queryByRole('button', { name: /開始/ })).toBeNull()
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))
    expect(screen.getByRole('dialog', { name: '請問，可以幫我找路嗎？' })).toBeTruthy()
    expect(loadVisit()).toBeNull()
  })

  it('can ask while waiting and ignores the late reply after the card closes', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))
    expect(screen.getByRole('dialog', { name: '請問，可以幫我找路嗎？' })).toBeTruthy()
    await ui.user.click(screen.getByRole('button', { name: '好了' }))
    await pending.reply(PHARMACY)

    expect(screen.queryByRole('button', { name: '對' })).toBeNull()
    expect(ui.find.disabled).toBe(false)
    expect(ui.input.value).toBe('藥局')
    expect(document.activeElement).toBe(ui.input)
    expect(loadVisit()).toBeNull()
  })

  it('can retry after generic help and then asks about the confirmed visit destination', async () => {
    const uncertain = pendingReply()
    const pharmacy = pendingReply()
    fetchMock.mockReturnValueOnce(uncertain.promise).mockReturnValueOnce(pharmacy.promise)
    const ui = setup()
    await ui.enter('今天天氣如何')
    await ui.user.click(ui.find)
    await uncertain.reply({ mode: 'nemotron', destination: { kind: 'uncertain' } })
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))
    await ui.user.click(screen.getByRole('button', { name: '好了' }))
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await pharmacy.reply(PHARMACY)
    await ui.user.click(screen.getByRole('button', { name: '對' }))
    const visit = loadVisit()
    expect(visit?.legIndex).toBe(2)
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))

    expect(screen.getByRole('dialog', { name: '請問，藥局？' })).toBeTruthy()
    expect(loadVisit()).toEqual(visit)
  })

  it('speaks only the fixed generic request, including when asked to repeat it', async () => {
    const speak = vi.fn()
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      lang = ''
      rate = 1
      volume = 1
      constructor(public text: string) {}
    })
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() })
    const ui = setup()
    await ui.enter('不要唸出這段文字')
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))
    await ui.user.click(screen.getByRole('button', { name: '再說一遍' }))

    // StrictMode may replay the mount effect; every utterance must be identical.
    expect(speak.mock.calls.length).toBeGreaterThanOrEqual(2)
    for (const [utterance] of speak.mock.calls) {
      expect(utterance.text).toBe('請問，可以幫我找路嗎？')
      expect(utterance.lang).toBe('zh-TW')
    }
    expect(loadVisit()).toBeNull()
  })

  it('only offers the explicitly labelled demo before a destination query', async () => {
    const ui = setup()
    expect(screen.queryByRole('button', { name: '開始' })).toBeNull()
    await ui.user.click(screen.getByRole('button', { name: '開始示範行程' }))
    expect(loadVisit()?.legIndex).toBe(0)
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))
    expect(screen.getByRole('dialog', { name: '請問，神經外科？' })).toBeTruthy()
  })

  it('does not reuse a previous visit destination after reset', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await pending.reply(PHARMACY)
    await ui.user.click(screen.getByRole('button', { name: '對' }))
    await ui.reset()
    await ui.user.click(screen.getByRole('button', { name: '幫我問' }))

    expect(screen.getByRole('dialog', { name: '請問，可以幫我找路嗎？' })).toBeTruthy()
    expect(loadVisit()).toBeNull()
  })
})

describe('switching language', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    document.documentElement.lang = 'zh-TW'
  })

  const toEnglish = (ui: ReturnType<typeof setup>) =>
    ui.user.selectOptions(screen.getByRole('combobox', { name: 'Language / 語言' }), 'en')

  it('keeps what the person typed and the destination waiting for 對, now asked in English', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await pending.reply(PHARMACY)
    await toEnglish(ui)

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Where do you want to go?' }).value).toBe('藥局')
    expect(screen.getByText('Go to Pharmacy?')).toBeTruthy()
    expect(loadVisit()).toBeNull()
    await ui.user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(loadVisit()?.legIndex).toBe(2)
  })

  it('answers a request sent before the switch in the language now on screen', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await toEnglish(ui)
    await pending.reply(PHARMACY)

    expect(screen.getByText('Go to Pharmacy?')).toBeTruthy()
    expect(screen.queryByText(/要去藥局/)).toBeNull()
  })

  it('keeps a visit under way where it is and names its places in English', async () => {
    const pending = pendingReply()
    fetchMock.mockReturnValueOnce(pending.promise)
    const ui = setup()
    await ui.enter('藥局')
    await ui.user.click(ui.find)
    await pending.reply(PHARMACY)
    await ui.user.click(screen.getByRole('button', { name: '對' }))
    const visit = loadVisit()
    await toEnglish(ui)

    expect(loadVisit()).toEqual(visit)
    expect(screen.getByText('Pharmacy')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
    expect(screen.getByText('Registration counter')).toBeTruthy()
    await ui.user.click(screen.getByRole('button', { name: 'Help me ask' }))
    expect(screen.getByRole('dialog', { name: 'Excuse me, which way to Pharmacy?' })).toBeTruthy()
  })

  it('stops the sentence being spoken, so the old language is not heard over the new screen', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel })
    const ui = setup()
    await toEnglish(ui)

    expect(cancel).toHaveBeenCalled()
    expect(document.documentElement.lang).toBe('en')
    expect(new URLSearchParams(window.location.search).get('lang')).toBe('en')
  })

  it('speaks exactly the English sentence on the card, with an English voice', async () => {
    const speak = vi.fn()
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      lang = ''
      rate = 1
      volume = 1
      constructor(public text: string) {}
    })
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() })
    const ui = setup()
    await toEnglish(ui)
    await ui.user.click(screen.getByRole('button', { name: 'Help me ask' }))
    await ui.user.click(screen.getByRole('button', { name: 'Say it again' }))

    expect(screen.getByRole('dialog', { name: 'Excuse me, can you help me find my way?' })).toBeTruthy()
    expect(speak.mock.calls.length).toBeGreaterThanOrEqual(2)
    for (const [utterance] of speak.mock.calls) {
      expect(utterance.text).toBe('Excuse me, can you help me find my way?')
      expect(utterance.lang).toBe('en-US')
    }
  })

  it('opens in English from ?lang=en and switches back to Chinese', async () => {
    window.history.replaceState(null, '', '/?lang=en')
    const user = userEvent.setup()
    render(<StrictMode><App /></StrictMode>)
    expect(screen.getByRole('textbox', { name: 'Where do you want to go?' })).toBeTruthy()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language / 語言' }), 'zh-TW')
    expect(screen.getByRole('textbox', { name: '想去哪裡' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('zh-TW')
  })
})
