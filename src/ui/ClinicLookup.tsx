import { useRef, useState } from 'react'
import { CAMPUS_EN, englishName, findDepartments } from '../clinics/english'
import { TPECH_HOME, type Campus, type Department } from '../clinics/tpech'
import type { Locale } from '../registry/types'
import { label } from '../render/renderer'

type Status = 'idle' | 'loading' | 'unavailable'

async function lookUp<T>(path: string): Promise<T> {
  const res = await fetch(path, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`lookup ${res.status}`)
  return (await res.json()) as T
}

/**
 * Which outpatient departments a Taipei City Hospital campus lists, read from
 * the hospital's own pages (through Tavily, by the indoor proxy). Separate
 * from where-to-go on purpose: this is the hospital's list and its
 * registration links, not a destination the bird can walk to.
 */
export function ClinicLookup({ locale }: { locale: Locale }) {
  const t = (key: Parameters<typeof label>[0]) => label(key, { locale })
  const [campuses, setCampuses] = useState<Campus[] | null>(null)
  const [campus, setCampus] = useState('')
  const [list, setList] = useState<{ source: string; departments: Department[] } | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  // Only the latest request may fill the screen; a slow earlier campus is dropped.
  const latest = useRef(0)

  const request = async <T,>(path: string, apply: (value: T) => void) => {
    const id = ++latest.current
    setStatus('loading')
    try {
      const value = await lookUp<T>(path)
      if (id !== latest.current) return
      apply(value)
      setStatus('idle')
    } catch {
      if (id === latest.current) setStatus('unavailable')
    }
  }

  const open = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open && campuses === null && status !== 'loading') {
      void request<{ campuses: Campus[] }>('/indoor-api/campuses', (v) => setCampuses(v.campuses))
    }
  }

  const choose = (code: string) => {
    setCampus(code)
    setList(null)
    setQuery('')
    void request<{ source: string; departments: Department[] }>(`/indoor-api/departments?campus=${encodeURIComponent(code)}`, setList)
  }

  const campusName = (c: Campus) => (locale === 'en' && CAMPUS_EN[c.name] ? `${CAMPUS_EN[c.name]} ${c.name}` : c.name)
  const found = list ? findDepartments(list.departments, query) : []

  return (
    <details className="clinics" onToggle={open}>
      <summary>{t('label.clinics')}</summary>
      <p className="note">{t('label.clinics.note')}</p>

      {campuses ? (
        <label className="field">
          <span className="label">{t('label.clinics.campus')}</span>
          <select value={campus} onChange={(event) => choose(event.target.value)}>
            <option value="" disabled>
              —
            </option>
            {campuses.map((c) => (
              <option key={c.code} value={c.code}>
                {campusName(c)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {list ? (
        <label className="field">
          <span className="label">{t('label.clinics.search')}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
        </label>
      ) : null}

      <p className="status" aria-live="polite">
        {status === 'loading' ? t('label.clinics.loading') : null}
        {status === 'unavailable' ? t('label.clinics.unavailable') : null}
        {status === 'idle' && list && found.length === 0 ? t('label.clinics.none') : null}
      </p>

      {list && found.length > 0 ? (
        <ul className="departments">
          {found.map((d) => {
            const en = locale === 'en' ? englishName(d.name) : undefined
            return (
              <li key={`${d.code} ${d.name}`}>
                <span className="name">
                  {en ? <span lang="en">{en}</span> : null}
                  <span lang="zh-TW">{d.name}</span>
                </span>
                <a href={d.registrationUrl} target="_blank" rel="noopener noreferrer">
                  {t('label.clinics.register')}
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}

      {list ? (
        <p className="source">
          {t('label.clinics.source')}{' '}
          <a href={list.source} target="_blank" rel="noopener noreferrer">
            {list.source}
          </a>
        </p>
      ) : null}
      <p className="source">
        <a href={TPECH_HOME} target="_blank" rel="noopener noreferrer">
          {t('label.clinics.official')}
        </a>
      </p>
    </details>
  )
}
