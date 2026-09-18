import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The one import rule that may never be broken: src/engine/ is pure domain code.
 *
 * If cue derivation ever ends up inside a React effect, the bird only works
 * while that screen is open — which is exactly the thing that makes a hardware
 * line impossible to finish later.
 */
const ENGINE_DIR = join(process.cwd(), 'src', 'engine')

const FORBIDDEN_IMPORTS = [/from\s+['"]react/, /from\s+['"].*\/ui\//, /from\s+['"].*\/adapters\//]
const FORBIDDEN_GLOBALS = [/\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\bnavigator\./]

describe('engine purity', () => {
  const files = readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('has engine files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s imports no React, UI or adapter', (file) => {
    const source = readFileSync(join(ENGINE_DIR, file), 'utf8')
    for (const pattern of FORBIDDEN_IMPORTS) {
      expect(pattern.test(source), `${file} matches ${pattern}`).toBe(false)
    }
  })

  it.each(files)('%s touches no DOM global', (file) => {
    const source = readFileSync(join(ENGINE_DIR, file), 'utf8')
    for (const pattern of FORBIDDEN_GLOBALS) {
      expect(pattern.test(source), `${file} matches ${pattern}`).toBe(false)
    }
  })
})
