import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

interface FavouritesState {
  /** Song and episode ids, most recently added first. Saved on the device. */
  ids: string[];
  /** Adds the item if it isn't a favourite, removes it if it is. Returns `true` when it is now a favourite. */
  toggle: (id: string) => boolean;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const isFavourite = get().ids.includes(id);
        set((state) => ({ ids: isFavourite ? state.ids.filter((x) => x !== id) : [id, ...state.ids] }));
        return !isFavourite;
      },
    }),
    { name: 'blac-favourites', storage: persistStorage },
  ),
);

/** `true` if the item is a favourite. Re-renders only when this item's status changes. */
export const useIsFavourite = (id: string) => useFavouritesStore((state) => state.ids.includes(id));
