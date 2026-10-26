// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseCampuses, parseDepartments } from '../clinics/tpech'
import { ClinicLookup } from './ClinicLookup'

const campuses = parseCampuses(readFileSync('server/fixtures/tpech-home.md', 'utf8'))
const renai = parseDepartments(readFileSync('server/fixtures/tpech-campus-F.md', 'utf8'), 'F')
const zhongxing = [{ code: '0700', name: '中興測試科', registrationUrl: 'https://webreg.tpech.gov.tw/x' }]

/** The indoor proxy, answering from the saved hospital pages. Counts calls: each could cost a credit. */
function proxy({ fail = false, delays = {} as Record<string, number> } = {}) {
  const calls: string[] = []
  const answer = (body: unknown) => new Response(JSON.stringify(body), { status: fail ? 502 : 200 })
  vi.stubGlobal('fetch', async (path: string) => {
    calls.push(path)
    await new Promise((resolve) => setTimeout(resolve, delays[path] ?? 0))
    if (path === '/indoor-api/campuses') return answer({ source: 'https://webreg.tpech.gov.tw/', campuses })
    const campus = new URL(path, 'http://x').searchParams.get('campus')
    const departments = campus === 'F' ? renai : zhongxing
    return answer({ source: `https://webreg.tpech.gov.tw/RegOnline1_1.aspx?ZCode=${campus}`, departments })
  })
  return calls
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openAndChoose(locale: 'zh-TW' | 'en', campus: string, name: string | RegExp) {
  const user = userEvent.setup()
  render(<ClinicLookup locale={locale} />)
  await user.click(screen.getByText(locale === 'en' ? 'Clinic lookup' : '門診科別查詢'))
  const select = await screen.findByRole('combobox', { name: locale === 'en' ? 'Hospital branch' : '院區' })
  await user.selectOptions(select, campus)
  await screen.findByText(name)
  return user
}

describe('clinic lookup', () => {
  it('asks the hospital nothing until the person opens it', () => {
    const calls = proxy()
    render(<ClinicLookup locale="zh-TW" />)
    expect(calls).toEqual([])
  })

  it('lists the chosen campus departments by their official names, each with its registration page', async () => {
    proxy()
    const user = await openAndChoose('zh-TW', 'F', '神經外科')
    await user.type(screen.getByRole('searchbox', { name: '科別' }), '神經外')

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText('神經外科')).toBeTruthy()
    expect(within(items[0]).getByRole('link', { name: '掛號頁面' }).getAttribute('href')).toBe(renai.find((d) => d.name === '神經外科')!.registrationUrl)
    expect(screen.getByRole('link', { name: 'https://webreg.tpech.gov.tw/RegOnline1_1.aspx?ZCode=F' })).toBeTruthy()
  })

  it('finds a department from English and shows the official Chinese name beside the translation', async () => {
    proxy()
    const user = await openAndChoose('en', 'F', 'Ophthalmology')
    await user.type(screen.getByRole('searchbox', { name: 'Department' }), 'eye')

    const [item] = screen.getAllByRole('listitem')
    expect(within(item).getByText('Ophthalmology')).toBeTruthy()
    expect(within(item).getByText('眼科')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Renai Branch 仁愛院區' })).toBeTruthy()
  })

  it('says when this campus has no such department', async () => {
    proxy()
    const user = await openAndChoose('zh-TW', 'F', '神經外科')
    await user.type(screen.getByRole('searchbox', { name: '科別' }), '獸醫')
    expect(screen.getByText('這個院區沒有符合的科別。')).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toEqual([])
  })

  it('says the list is unavailable, never that there are no clinics, and still links to the hospital', async () => {
    proxy({ fail: true })
    const user = userEvent.setup()
    render(<ClinicLookup locale="zh-TW" />)
    await user.click(screen.getByText('門診科別查詢'))

    expect(await screen.findByText('現在查不到醫院資料。')).toBeTruthy()
    expect(screen.queryByText('這個院區沒有符合的科別。')).toBeNull()
    expect(screen.getByRole('link', { name: '臺北市立聯合醫院網路掛號' }).getAttribute('href')).toBe('https://webreg.tpech.gov.tw/')
  })

  it('shows the campus chosen last even when an earlier one answers later', async () => {
    proxy({ delays: { '/indoor-api/departments?campus=F': 300 } })
    const user = userEvent.setup()
    render(<ClinicLookup locale="zh-TW" />)
    await user.click(screen.getByText('門診科別查詢'))
    const select = await screen.findByRole('combobox', { name: '院區' })
    await user.selectOptions(select, 'F')
    await user.selectOptions(select, 'G')

    expect(await screen.findByText('中興測試科')).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await waitFor(() => expect(screen.queryByText('神經外科')).toBeNull())
    expect(screen.getByText('中興測試科')).toBeTruthy()
  })
})
