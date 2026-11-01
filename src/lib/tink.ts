import type { AudioPlayer } from 'expo-audio';

// The soft tink as today's block lands (Settings > Sound when marking; scripts/make-tink.cjs makes
// the file). The audio module loads on first use: an older build without it stays silent rather
// than failing to start, and on an iPhone the silent switch still silences it.

let player: AudioPlayer | null | undefined;

function load(): AudioPlayer | null {
  if (player !== undefined) return player;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
    player = createAudioPlayer(require('../../assets/sounds/tink.wav') as number);
  } catch {
    player = null;
  }
  return player;
}

/** Loads the sound ahead of the first mark, so it plays on time. */
export function preloadTink(): void {
  load();
}

export function playTink(): void {
  const p = load();
  if (!p) return;
  p.seekTo(0).catch(() => {});
  p.play();
}
