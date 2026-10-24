import type { StringKey } from './keys'

/**
 * English strings. Hand written from the voice principle in zh-TW.ts, not
 * machine translated: steady, plain, no apology, no celebration. No
 * contractions, as in the outdoor English table.
 *
 * Spoken by the browser's English voice; there are no English recordings.
 * Pending review with the rest of PR⑤.
 */
export const EN: Record<StringKey, string> = {
  'guidance.go': 'Go straight ahead.',
  'guidance.turn.left': 'Go to your left.',
  'guidance.turn.right': 'Go to your right.',
  'guidance.uncertain': 'I am not sure. I will help you ask.',
  'guidance.arrived': '{place}. You have arrived.',
  'guidance.wait': '',
  'guidance.none': '',
  'ask.utterance': 'Excuse me, which way to {place}?',
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
  'label.confirm': 'Go to {place}?',
  'label.yes': 'Yes',
  'label.no': 'No',
  'fallback.safe': 'I am not sure. I will help you ask.',
}
