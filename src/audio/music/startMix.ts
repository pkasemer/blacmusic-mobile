import { Alert } from 'react-native';
import type { Track } from '@/domain/types';
import { showToast } from '@/store/toastStore';
import { fetchMix, rememberMix } from './mixData';
import { playMix } from './musicEngine';

/**
 * "Start mix", chosen by the listener: gets songs based on `track`, plays the song followed by them, and says so.
 * Resolves `true` when the mix started (its page can then be opened).
 */
export async function startMix(track: Track): Promise<boolean> {
  try {
    const mix = await fetchMix(track, 'mix');
    if (mix.tracks.length === 0) {
      Alert.alert('Not enough music yet', `There are no other songs like “${track.title}” to make a mix from.`);
      return false;
    }
    rememberMix(mix);
    playMix(mix.reference, mix.tracks);
    showToast(`Mix started: ${mix.tracks.length} ${mix.tracks.length === 1 ? 'song' : 'songs'} like “${track.title}”`);
    return true;
  } catch {
    Alert.alert("Can't start the mix", 'Check your connection and try again.');
    return false;
  }
}
