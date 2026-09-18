import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Observation, Posture } from '../engine/types'
import { step } from '../engine/engine'
import { deriveCue } from '../engine/cues'
import { DEMO_VISIT, MOCK_VENUE, START_NODE_ID } from '../venue/mock'
import { renderAsk, renderGuidance, renderNextCheckpoint } from '../render/renderer'
import { VirtualBirdAdapter } from '../adapters/virtual'
import { clearVisit, loadVisit, saveVisit, type VisitSnapshot } from '../persistence/visitStore'
import { speak } from './speech'

const TICK_MS = 1000
const DECAY_STEP_MS = 5 * 60 * 1000

interface VisitState {
  legIndex: number
  lastObservation: Observation | null
  posture: Posture
  startedAt: number
}

function observationAt(nodeId: string, at: number, source: Observation['source']): Observation {
  const node = MOCK_VENUE.nodes[nodeId]
  return {
    nodeId,
    at,
    // A button confirm carries no orientation prior: we were not made to face a wall.
    facingBearing: source === 'QR' ? (node ? node.qrFacingBearing : null) : null,
    source,
  }
}

export function useNightingale(adapter: VirtualBirdAdapter) {
  const [visit, setVisit] = useState<VisitState | null>(null)
  const [timeShiftMs, setTimeShiftMs] = useState(0)
  const [askOpen, setAskOpen] = useState(false)
  const [, setTick] = useState(0)
  const [lastEvent, setLastEvent] = useState<string | null>(null)

  // Resume silently. No welcome back, no recap.
  useEffect(() => {
    const snapshot = loadVisit()
    if (snapshot && snapshot.venueId === MOCK_VENUE.id && snapshot.legIndex < DEMO_VISIT.length) {
      setVisit({
        legIndex: snapshot.legIndex,
        lastObservation: snapshot.lastObservation,
        posture: snapshot.posture,
        startedAt: snapshot.startedAt,
      })
    }
  }, [])

  useEffect(() => {
    if (visit === null) return
    const snapshot: VisitSnapshot = {
      version: 1,
      venueId: MOCK_VENUE.id,
      legIndex: visit.legIndex,
      lastObservation: visit.lastObservation,
      posture: visit.posture,
      startedAt: visit.startedAt,
    }
    saveVisit(snapshot)
  }, [visit])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const now = Date.now() + timeShiftMs

  const output = useMemo(() => {
    const leg = DEMO_VISIT[visit ? Math.min(visit.legIndex, DEMO_VISIT.length - 1) : 0]
    return step({
      graph: MOCK_VENUE,
      leg,
      lastObservation: visit ? visit.lastObservation : null,
      posture: visit ? visit.posture : 'MOVING',
      now,
    })
    // `now` advances every tick; that is the intended recompute trigger.
  }, [visit, now])

  const cue = deriveCue(output.state, output.instruction)
  const guidance = renderGuidance(output.instruction, now)
  const checkpoint = renderNextCheckpoint(output.nextCheckpointPlaceId, now)
  const ask = renderAsk(DEMO_VISIT[visit ? Math.min(visit.legIndex, DEMO_VISIT.length - 1) : 0].destinationId, now)

  useEffect(() => {
    adapter.send(cue)
  }, [adapter, cue])

  const start = useCallback(() => {
    setTimeShiftMs(0)
    setVisit({
      legIndex: 0,
      lastObservation: observationAt(START_NODE_ID, Date.now(), 'QR'),
      posture: 'MOVING',
      startedAt: Date.now(),
    })
  }, [])

  const observe = useCallback(
    (nodeId: string, source: Observation['source']) => {
      setTimeShiftMs(0)
      setVisit((current) =>
        current === null
          ? current
          : { ...current, lastObservation: observationAt(nodeId, Date.now(), source), posture: 'MOVING' },
      )
    },
    [],
  )

  const advanceLeg = useCallback(() => {
    setVisit((current) =>
      current === null || current.legIndex >= DEMO_VISIT.length - 1
        ? current
        : { ...current, legIndex: current.legIndex + 1 },
    )
  }, [])

  const setPosture = useCallback((posture: Posture) => {
    setVisit((current) => (current === null ? current : { ...current, posture }))
  }, [])

  const askForMe = useCallback(() => {
    setAskOpen(true)
  }, [])

  const closeAsk = useCallback(() => setAskOpen(false), [])

  const decay = useCallback(() => setTimeShiftMs((v) => v + DECAY_STEP_MS), [])

  const reset = useCallback(() => {
    clearVisit()
    setVisit(null)
    setTimeShiftMs(0)
    setAskOpen(false)
  }, [])

  // Everything the bird can do must be reachable from the adapter, not only
  // from a modal in the UI: the physical bird has one button and no screen.
  const handlers = useRef({
    askForMe,
    advanceLeg,
    observe,
    nextCheckpointNodeId: output.nextCheckpointNodeId,
    arrived: output.state.progress === 'ARRIVED',
  })
  handlers.current = {
    askForMe,
    advanceLeg,
    observe,
    nextCheckpointNodeId: output.nextCheckpointNodeId,
    arrived: output.state.progress === 'ARRIVED',
  }

  useEffect(() => {
    return adapter.on((event) => {
      setLastEvent(event)
      const h = handlers.current
      if (event === 'LONG_PRESS') {
        h.askForMe()
        return
      }
      if (h.arrived) {
        h.advanceLeg()
        return
      }
      if (h.nextCheckpointNodeId) h.observe(h.nextCheckpointNodeId, 'BUTTON_CONFIRM')
    })
  }, [adapter])

  const speakAsk = useCallback(() => speak(ask.speech), [ask.speech])

  return {
    started: visit !== null,
    visit,
    now,
    output,
    cue,
    guidance,
    checkpoint,
    ask,
    askOpen,
    lastEvent,
    timeShiftMs,
    actions: {
      start,
      observe,
      advanceLeg,
      setPosture,
      askForMe,
      closeAsk,
      decay,
      reset,
      speakAsk,
      simulateShortPress: () => adapter.emit('SHORT_PRESS'),
      simulateLongPress: () => adapter.emit('LONG_PRESS'),
    },
  }
}
