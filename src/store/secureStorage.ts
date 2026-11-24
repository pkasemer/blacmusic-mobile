import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * Storage for sign-in tokens: the system keychain (iOS) or keystore (Android) through `expo-secure-store`.
 *
 * `expo-secure-store` has a native part. It is loaded inside a try/catch so a development build that
 * was made before it was added keeps working: tokens then fall back to ordinary storage until the app
 * is rebuilt.
 */
type SecureStoreModule = typeof import('expo-secure-store');

let SecureStore: SecureStoreModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require('expo-secure-store') as SecureStoreModule;
  // Calling it once proves the native module is really there.
  SecureStore.getItem('blac-probe');
} catch {
  SecureStore = null;
}

const secureState: StateStorage = {
  getItem: async (name) => (SecureStore ? SecureStore.getItemAsync(name) : AsyncStorage.getItem(name)),
  setItem: async (name, value) => {
    if (SecureStore) await SecureStore.setItemAsync(name, value);
    else await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    if (SecureStore) await SecureStore.deleteItemAsync(name);
    else await AsyncStorage.removeItem(name);
  },
};

export const secureStorage = createJSONStorage(() => secureState);
