import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCampuses, parseDepartments, registrationUrl } from './tpech'

// Real Tavily Extract output, 2026-10-26.
const home = readFileSync('server/fixtures/tpech-home.md', 'utf8')
const renai = readFileSync('server/fixtures/tpech-campus-F.md', 'utf8')

describe('campuses', () => {
  it('reads every campus and outpatient branch once, with its code', () => {
    const campuses = parseCampuses(home)
    expect(campuses).toHaveLength(25)
    expect(campuses[0]).toEqual({ code: 'F', name: '仁愛院區' })
    expect(campuses).toContainEqual({ code: 'K1', name: '社區心理衛生中心' })
    expect(new Set(campuses.map((c) => c.code)).size).toBe(campuses.length)
  })

  it('does not take the by-department links for campuses', () => {
    expect(parseCampuses(home).map((c) => c.name)).not.toContain('內科醫療部')
  })
})

describe('departments', () => {
  const departments = parseDepartments(renai, 'F')

  it('keeps every official name exactly as the page writes it', () => {
    for (const d of departments) expect(renai).toContain(`[${d.name.replace('_', '\\_')}]`)
    expect(departments.map((d) => d.name)).toEqual(expect.arrayContaining(['神經外科', '中醫婦(兒)科', '興岩復健治療中心_復健科']))
  })

  it('lists each department once although the page repeats the whole list', () => {
    expect(departments.filter((d) => d.name === '神經外科')).toHaveLength(1)
    expect(new Set(departments.map((d) => `${d.code} ${d.name}`)).size).toBe(departments.length)
  })

  it('keeps one name under each code it is offered under', () => {
    // The hospital books the same COVID-19 clinic under five department codes.
    expect(departments.filter((d) => d.name === 'COVID-19確診者開立抗病毒藥物門診').map((d) => d.code).sort()).toEqual(['0100', '0200', 'AA00', 'AF00', 'AH00'])
  })

  it('links to the hospital page for that department, brackets included', () => {
    const dept = departments.find((d) => d.name === '中醫婦(兒)科')!
    expect(dept.registrationUrl).toBe(registrationUrl('F', '6006', '中醫婦(兒)科'))
    const url = new URL(dept.registrationUrl)
    expect(url.origin + url.pathname).toBe('https://webreg.tpech.gov.tw/RegOnline1_2.aspx')
    expect(url.searchParams.get('deptname')).toBe('中醫婦(兒)科')
    expect(url.searchParams.get('DeptCode')).toBe('6006')
  })

  it('links to the same page the hospital links to', () => {
    const original = 'RegOnline1_2.aspx?ZCode=F&DeptCode=0700&deptname=%e7%a5%9e%e7%b6%93%e5%a4%96%e7%a7%91'
    const ours = new URL(departments.find((d) => d.name === '神經外科')!.registrationUrl)
    expect([...ours.searchParams]).toEqual([...new URL(original, 'https://webreg.tpech.gov.tw/').searchParams])
  })

  it('ignores departments of another campus', () => {
    expect(parseDepartments(renai, 'G')).toEqual([])
  })
})
