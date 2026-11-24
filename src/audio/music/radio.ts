import { Alert } from 'react-native';
import { blacApi } from '@/api/blac';
import type { Track } from '@/domain/types';
import { shuffled } from './queue';
import { playQueue } from './musicEngine';

const RADIO_LENGTH = 30;

/**
 * "Start radio": plays `track` first, then a shuffled mix of songs that sound like it (same genre or same artist).
 * The mix is built when you start it, from what the catalogue has, so a small catalogue gives a short radio.
 * Resolves `true` when something started playing.
 */
export async function startRadio(track: Track): Promise<boolean> {
  try {
    const similar = await blacApi.getSimilarTracks(track);
    if (similar.length === 0) {
      Alert.alert('Not enough music yet', "There aren't other songs like this one to build a radio from.");
      return false;
    }
    // Already shuffled here, so the queue keeps this order whatever the shuffle button says.
    playQueue([track, ...shuffled(similar).slice(0, RADIO_LENGTH)], 0, { shuffle: false, source: { type: 'radio', name: track.title } });
    return true;
  } catch {
    Alert.alert("Can't start radio", 'Check your connection and try again.');
    return false;
  }
}
