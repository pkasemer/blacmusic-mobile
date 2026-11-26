import { create } from 'zustand';

export type LibrarySection = 'favourites' | 'recent' | 'playlists' | 'downloads';

/** Which list the Library shows. Kept outside the screen so the cards on Home can open it on the right one. Not saved. */
export const useLibraryStore = create<{ section: LibrarySection; show: (section: LibrarySection) => void }>()((set) => ({
  section: 'favourites',
  show: (section) => set({ section }),
}));
