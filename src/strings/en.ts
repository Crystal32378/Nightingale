import type { StringKey } from './keys'

/**
 * English strings. Hand written from the voice principle in zh-TW.ts, not
 * machine translated: steady, plain, no apology, no celebration. No
 * contractions, as in the outdoor English table.
 *
 * The help-card sentences are recorded (src/ui/speech.ts); everything else
 * that speaks uses the browser's English voice. Pending review with PR⑤.
 */
export const EN: Record<StringKey, string> = {
  'guidance.go': 'Go straight ahead.',
  'guidance.turn.left': 'Go left.',
  'guidance.turn.right': 'Go right.',
  'guidance.uncertain': 'I am not sure. I will help you ask.',
  'guidance.arrived': 'This is the {place}.',
  'guidance.wait': '',
  'guidance.none': '',
  'ask.utterance': 'Excuse me, which way to the {place}?',
  'ask.generic': 'Excuse me, can you help me find my way?',
  'checkpoint.next': 'Next: {place}',
  'place.bare': '{place}',
  'label.current': 'Current location',
  'label.destination': 'Destination',
  'label.ask': 'Help me ask',
  'label.rest': 'Rest',
  'label.resume': 'Continue',
  'label.start': 'Start demo visit',
  'label.again': 'Say it again',
  'label.done': 'Done',
  'label.underway': 'On the way',
  'label.arrived': 'Arrived',
  'label.volume.down': 'Quieter',
  'label.volume.up': 'Louder',
  'label.volume.level': 'Volume {n} of 4',
  'label.where': 'Where do you want to go?',
  'label.find': 'Find the way',
  'label.mode.mock': 'Mock',
  'label.mode.nemotron': 'Nemotron',
  'label.privacy':
    'What you type is sent to the Nemotron model on Nebius cloud to work out where you want to go, and is not kept after processing. Do not enter names, medical records or health conditions.',
  'label.confirm': 'Go to the {place}?',
  'label.yes': 'Yes',
  'label.no': 'No',
  'fallback.safe': 'I am not sure. I will help you ask.',
  'label.clinics': 'Clinic lookup',
  'label.clinics.note':
    'Outpatient departments and registration pages from the hospital website, not where they are in the building. English names are our translation; the official Chinese name is the reference.',
  'label.clinics.campus': 'Hospital branch',
  'label.clinics.search': 'Department',
  'label.clinics.loading': 'Looking up',
  'label.clinics.none': 'No matching department at this branch.',
  'label.clinics.unavailable': 'The hospital list is not available right now.',
  'label.clinics.register': 'Registration page',
  'label.clinics.source': 'Source',
  'label.clinics.official': 'Taipei City Hospital online registration',
}
