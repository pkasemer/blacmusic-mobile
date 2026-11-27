import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toggled, type LikeState } from '@/likes/likesRules';
import { persistStorage } from './storage';

/**
 * Liked songs and episodes. Saved on the device; liked songs are also kept by the server (see `likes/likesSync`).
 * Saved before the server kept them, only `ids` is there: the rest starts empty and those likes are sent up.
 */
interface FavouritesState extends LikeState {
  /** Adds the item if it isn't a favourite, removes it if it is. Returns `true` when it is now a favourite. */
  toggle: (id: string) => boolean;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      pending: {},
      onServer: [],
      localOnly: [],
      toggle: (id) => {
        const { liked, ...next } = toggled(get(), id);
        set(next);
        return liked;
      },
    }),
    { name: 'blac-favourites', storage: persistStorage },
  ),
);

/** `true` if the item is a favourite. Re-renders only when this item's status changes. */
export const useIsFavourite = (id: string) => useFavouritesStore((state) => state.ids.includes(id));
