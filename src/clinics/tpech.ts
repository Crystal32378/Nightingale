/**
 * Taipei City Hospital (臺北市立聯合醫院) online registration pages, as Tavily
 * Extract returns them in markdown. Everything shown comes from these pages:
 * campus and department names are the link text exactly as written there, and
 * the registration link is the hospital's own page for that department.
 *
 * This is a lookup, not navigation: nothing here says where a clinic is in a
 * building, books anything, or suggests a department for a symptom.
 */
export const TPECH_HOME = 'https://webreg.tpech.gov.tw/'

export interface Campus {
  /** The hospital's ZCode, e.g. F for 仁愛院區. */
  code: string
  name: string
}

export interface Department {
  /** The hospital's DeptCode. Not unique: one code can cover several names. */
  code: string
  /** Official Chinese name, exactly as the page writes it. */
  name: string
  registrationUrl: string
}

const CODE = /^[A-Za-z0-9]{1,4}$/

export const isCampusCode = (value: string) => CODE.test(value)

export const campusUrl = (campus: string) => `${TPECH_HOME}RegOnline1_1.aspx?ZCode=${campus}`

// Built rather than copied: in markdown a name with brackets, like 中醫婦(兒)科,
// cuts the copied link short.
export const registrationUrl = (campus: string, dept: string, name: string) =>
  `${TPECH_HOME}RegOnline1_2.aspx?ZCode=${campus}&DeptCode=${dept}&deptname=${encodeURIComponent(name)}`

/** Markdown escapes such as 興岩復健治療中心\_復健科. */
const unescape = (text: string) => text.replace(/\\(.)/g, '$1').trim()

/** The page lists everything twice (desktop and mobile layout); keep the first of each. */
function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => !seen.has(key(item)) && seen.add(key(item)))
}

export function parseCampuses(markdown: string): Campus[] {
  const links = [...markdown.matchAll(/\[((?:\\.|[^\]\\])+)\]\(RegOnline1_1\.aspx\?ZCode=([A-Za-z0-9]+)\)/g)]
  return unique(
    links.map(([, name, code]) => ({ code, name: unescape(name) })),
    (c) => c.code,
  )
}

export function parseDepartments(markdown: string, campus: string): Department[] {
  const links = [...markdown.matchAll(/\[((?:\\.|[^\]\\])+)\]\(RegOnline1_2\.aspx\?ZCode=([A-Za-z0-9]+)&DeptCode=([A-Za-z0-9]+)&/g)]
  return unique(
    links
      .filter(([, , zcode]) => zcode === campus)
      .map(([, text, , code]) => {
        const name = unescape(text)
        return { code, name, registrationUrl: registrationUrl(campus, code, name) }
      }),
    (d) => `${d.code} ${d.name}`,
  )
}
