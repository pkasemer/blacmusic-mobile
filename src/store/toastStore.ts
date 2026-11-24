import { create } from 'zustand';

/** A short message that shows at the bottom of the screen for a moment ("Added to Road trip"). Not saved. */
interface ToastState {
  message: string | null;
  /** Changes with every message, so showing the same text twice still restarts the timer. */
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

/** Shows a toast from anywhere (no React needed). */
export const showToast = (message: string) => useToastStore.getState().show(message);
