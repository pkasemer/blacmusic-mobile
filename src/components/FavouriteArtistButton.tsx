import { useState } from 'react';
import { Alert } from 'react-native';
import { Star } from 'lucide-react-native';
import type { Artist } from '@/domain/types';
import { setFavouriteArtist, useFavouriteArtistIds, MAX_FAVOURITE_ARTISTS } from '@/onboarding/favouriteArtists';
import { showToast } from '@/store/toastStore';
import { haptics } from '@/utils/haptics';
import { ActionButton, useSecondaryButton } from './DetailActions';

/**
 * Favourite / Favourited on an artist's page. Favourite artists help choose what goes into "Your sound"; they are
 * separate from following. The change shows at once; if it cannot be saved, it goes back and says so.
 */
export function FavouriteArtistButton({ artist }: { artist: Artist }) {
  const button = useSecondaryButton();
  const ids = useFavouriteArtistIds();
  // What was just tapped, shown while it is being saved.
  const [wanted, setWanted] = useState<boolean | null>(null);
  const on = wanted ?? ids?.includes(artist.id) ?? false;

  const toggle = async () => {
    if (wanted !== null) return;
    const next = !on;
    haptics.select();
    setWanted(next);
    try {
      const result = await setFavouriteArtist(
        { id: artist.id, name: artist.name, avatarUrl: artist.avatarUrl, verified: artist.verification === 'verified' },
        next,
      );
      if (result === 'last') showToast('Keep at least one favourite artist');
      else if (result === 'full') showToast(`You can have up to ${MAX_FAVOURITE_ARTISTS} favourite artists`);
      else showToast(next ? `${artist.name} is now a favourite` : `${artist.name} removed from favourites`);
    } catch {
      haptics.error();
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setWanted(null);
    }
  };

  return (
    <ActionButton
      label={on ? 'Favourited' : 'Favourite'}
      hint={on ? `${artist.name} is a favourite. Tap to remove` : `Add ${artist.name} to your favourite artists`}
      active={on}
      onPress={() => void toggle()}
      icon={<Star size={18} color={on ? button.accent : button.ink} fill={on ? button.accent : 'none'} />}
    />
  );
}
