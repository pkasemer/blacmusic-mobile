import { requireOptionalNativeModule } from 'expo';

interface BlacAudioBuffer {
  loadedUpTo(player: object): number;
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
