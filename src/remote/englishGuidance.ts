import type { RemoteAction } from './last300mClient'
import type { GuidanceView } from './remoteGuidance'
import { ENGLISH_SIGNS, LAST300M_EN } from './locale'
import script from './outdoor-en-script.json'

const lines = script.utterances
const recovery: Record<string, string> = {
  'recover.er': lines['recover.er'],
  'recover.daan': `${lines['recover.daan.a']} ${lines['recover.daan.b']}`,
  'recover.canopy': lines['recover.canopy'],
}
export function englishGuidance(action: RemoteAction, routeId?: string): GuidanceView {
  const held: GuidanceView = { kind: 'question', headline: LAST300M_EN['l3.reanchor.question'], lookFor: [] }
  if (routeId !== 'renai-001') return held
  if (action.type === 'CONFIRM_ARRIVAL' && action.checkpointId === 'cp5') return { kind: 'arrival', headline: LAST300M_EN['l3.arrived.headline'], lookFor: [] }
  if (action.type === 'RECOVER' && action.checkpointId === 'cp5' && action.messageKey && Object.prototype.hasOwnProperty.call(recovery, action.messageKey)) return { kind: 'instruction', headline: recovery[action.messageKey], lookFor: [] }
  if (action.type === 'ASK') {
    if (action.checkpointId === 'cp2' && action.confirmation?.kind === 'renai-before-second-crossing') return { ...held,
      headline: 'Have you crossed Fuxing South Road, are you safely on the sidewalk at the Renai Road intersection, and have you not crossed Renai Road yet?' }
    if (action.checkpointId === 'cp2' && action.messageKey === 'ask.youbike') return { ...held,
      headline: 'What does the street sign beside YouBike say?', lookFor: ["大安路一段116巷 — Lane 116, Section 1, Da'an Road", '仁愛路三段123巷13弄 — Alley 13, Lane 123, Section 3, Renai Road'] }
    if (action.checkpointId === 'cp2' && action.messageKey === 'ask.location-veto') return { ...held, headline: 'The location reading does not match this intersection. Please tell me the street names on the signs nearby.' }
    if (['cp4', 'cp5'].includes(action.checkpointId) && action.messageKey === 'ask.entrance') return { ...held, headline: lines['ask.entrance'], lookFor: ['急診 — Emergency'] }
  }
  if (action.type === 'REANCHOR') return { ...held,
    lookFor: (action.lookFor ?? []).slice(0, 5).map(item => {
      const clean = item.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 40)
      return clean ? `${clean} — ${Object.prototype.hasOwnProperty.call(ENGLISH_SIGNS, clean) ? ENGLISH_SIGNS[clean] : 'sign text'}` : ''
    }).filter(Boolean) }
  return held
}
