import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEPARTMENT_EN, englishName, findDepartments } from './english'
import { parseDepartments } from './tpech'

const renai = parseDepartments(readFileSync('server/fixtures/tpech-campus-F.md', 'utf8'), 'F')
const names = (query: string) => findDepartments(renai, query).map((d) => d.name)

describe('finding a department', () => {
  it('finds the official name from part of it in Chinese', () => {
    expect(names('神經')).toEqual(['神經內科', '神經外科'])
  })

  it('finds the official name from English, whatever the case', () => {
    expect(names('NEUROSURGERY')).toEqual(['神經外科'])
    expect(names('eye')).toEqual(['眼科'])
  })

  it('finds a department by its everyday English word', () => {
    expect(names('teeth')).toEqual(['牙科'])
  })

  it('lists everything for a blank search and nothing for a name that is not there', () => {
    expect(findDepartments(renai, '  ')).toHaveLength(renai.length)
    expect(names('veterinary')).toEqual([])
  })

  it('does not find a department through a translation the page does not have', () => {
    // 小兒科 has English, but Renai lists it only as 小兒科/健兒門診.
    expect(names('Pediatrics / Well-Child')).toEqual(['小兒科/健兒門診'])
    expect(renai.map((d) => d.name)).not.toContain('小兒科')
  })

  it('does not treat object built-ins as translations', () => {
    expect(englishName('constructor')).toBeUndefined()
    expect(findDepartments([{ code: 'X', name: 'toString', registrationUrl: '' }], 'function')).toEqual([])
  })

  it('translates only names the hospital actually uses at some campus', () => {
    const renaiNames = new Set(renai.map((d) => d.name))
    // 小兒科 is the name at other campuses; everything else is on the Renai page.
    const unknown = Object.keys(DEPARTMENT_EN).filter((name) => !renaiNames.has(name))
    expect(unknown).toEqual(['小兒科'])
  })
})
