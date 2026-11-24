import { create } from 'zustand';

export const BRAND_TINT = '#BB88FF';
export const BRAND_ACCENTS = ['#6C8BFF', '#FF7AB8'];

interface BrandState {
  tint: string;
  accents: string[];
  setPalette: (tint: string, accents: string[]) => void;
}

/**
 * The colour of the drifting light behind the welcome, tour and sign-in screens. The backdrop itself is drawn once, at
 * the root of the app, so moving between those screens never rebuilds it; each screen only says which colour it wants.
 */
export const useBrandStore = create<BrandState>()((set) => ({
  tint: BRAND_TINT,
  accents: BRAND_ACCENTS,
  setPalette: (tint, accents) => set({ tint, accents }),
}));
