import { requireOptionalNativeModule } from 'expo';

interface BlacAudioBuffer {
  loadedUpTo(player: object): number;
  keepPlaybackOnPhone?(player: object): void;
}

// Optional: a build of the app made before this was added (and Android, for now) simply does not have it.
const native = requireOptionalNativeModule<BlacAudioBuffer>('BlacAudioBuffer');

/**
 * How far, in seconds, the song playing in an expo-audio playlist has loaded. `null` when this build of the app
 * cannot tell.
 */
export function loadedUpTo(playlist: object): number | null {
  if (!native) return null;
  try {
    return native.loadedUpTo(playlist);
  } catch {
    return null;
  }
}

/**
 * Over AirPlay, has the iPhone play the music itself and send the sound, instead of handing a TV the song to fetch.
 * Builds made before this was added do not have it.
 */
export function keepPlaybackOnPhone(playlist: object): void {
  try {
    native?.keepPlaybackOnPhone?.(playlist);
  } catch {
    // AirPlay then behaves as the phone does by default.
  }
}
