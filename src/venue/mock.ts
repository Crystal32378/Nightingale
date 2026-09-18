import type { VenueGraph, VisitLeg } from '../engine/types'

/**
 * A synthetic venue. This is not a map of any real hospital, and is not
 * presented as one.
 *
 * Bearings are degrees, 0 = north, clockwise. `qrFacingBearing` is the
 * direction a person necessarily faces in order to scan the code stuck on that
 * wall — an installation fact, not a sensor reading.
 */
export const MOCK_VENUE: VenueGraph = {
  id: 'MOCK_CLINIC_BUILDING',
  nodes: {
    ENTRANCE: {
      id: 'ENTRANCE',
      placeId: 'ENTRANCE',
      qrFacingBearing: 0,
      edges: [{ to: 'REGISTRATION', bearing: 0 }],
    },
    REGISTRATION: {
      id: 'REGISTRATION',
      placeId: 'REGISTRATION',
      qrFacingBearing: 0,
      edges: [
        { to: 'ELEVATOR_IN', bearing: 90 },
        { to: 'ENTRANCE', bearing: 180 },
      ],
    },
    ELEVATOR_IN: {
      id: 'ELEVATOR_IN',
      placeId: 'ELEVATOR_IN',
      qrFacingBearing: 90,
      edges: [
        { to: 'ELEVATOR_OUT', bearing: null },
        { to: 'REGISTRATION', bearing: 270 },
      ],
    },
    ELEVATOR_OUT: {
      id: 'ELEVATOR_OUT',
      placeId: 'ELEVATOR_OUT',
      qrFacingBearing: 180,
      edges: [
        { to: 'CLINIC', bearing: 90 },
        { to: 'ELEVATOR_IN', bearing: null },
      ],
    },
    CLINIC: {
      id: 'CLINIC',
      placeId: 'NEUROSURGERY',
      qrFacingBearing: 90,
      edges: [
        { to: 'CASHIER', bearing: 180 },
        { to: 'ELEVATOR_OUT', bearing: 270 },
      ],
    },
    CASHIER: {
      id: 'CASHIER',
      placeId: 'CASHIER',
      qrFacingBearing: 180,
      edges: [
        { to: 'PHARMACY', bearing: 180 },
        { to: 'CLINIC', bearing: 0 },
      ],
    },
    PHARMACY: {
      id: 'PHARMACY',
      placeId: 'PHARMACY',
      qrFacingBearing: 180,
      edges: [
        { to: 'EXIT', bearing: 270 },
        { to: 'CASHIER', bearing: 0 },
      ],
    },
    EXIT: {
      id: 'EXIT',
      placeId: 'EXIT',
      qrFacingBearing: 0,
      edges: [{ to: 'PHARMACY', bearing: 90 }],
    },
  },
}

export const START_NODE_ID = 'ENTRANCE'

/** The demo visit: one leg at a time, and only the current one is ever disclosed. */
export const DEMO_VISIT: VisitLeg[] = [
  { destinationId: 'NEUROSURGERY', destinationNodeId: 'CLINIC' },
  { destinationId: 'CASHIER', destinationNodeId: 'CASHIER' },
  { destinationId: 'PHARMACY', destinationNodeId: 'PHARMACY' },
  { destinationId: 'EXIT', destinationNodeId: 'EXIT' },
]
