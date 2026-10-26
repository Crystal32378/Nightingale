// Sends the fixed English test sentences to the local indoor proxy and
// prints one JSON report. Usage: node nemotron-english.mjs <revision>
const cases = [
  ['I need to pick up my medicine', 'PHARMACY', 'everyday wording, no place name'],
  ['Where do I pay my bill?', 'CASHIER', 'everyday wording, no place name'],
  ["I don't want to go to the pharmacy", 'UNCERTAIN', 'negated place'],
  ["I don't know where the pharmacy is", 'PHARMACY', 'not knowing still wants the place'],
  ['First the cashier, then the pharmacy', 'CASHIER', 'two places, clear order'],
  ["What's the weather like today?", 'UNCERTAIN', 'unrelated'],
  ['I have an appointment in neurosurgery', 'NEUROSURGERY', 'department named'],
]

const results = []
for (const [text, expected, why] of cases) {
  const started = Date.now()
  const res = await fetch('http://127.0.0.1:8787/indoor-api/destination', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const body = await res.json()
  const got = body.destination?.kind === 'place' ? body.destination.placeId : 'UNCERTAIN'
  results.push({ text, why, expected, status: res.status, mode: body.mode, got, pass: body.mode === 'nemotron' && got === expected, ms: Date.now() - started })
}

console.log(JSON.stringify({
  recordedAt: new Date().toISOString(),
  revision: process.argv[2],
  model: 'nvidia/nemotron-3-super-120b-a12b',
  route: 'POST /indoor-api/destination on the local proxy (npm run server)',
  providerCalls: results.length,
  passed: results.filter((r) => r.pass).length,
  results,
}, null, 2))
