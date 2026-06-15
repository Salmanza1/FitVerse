import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env — restart Expo after fixing.'
    );
} else if (!supabaseUrl.startsWith('https://')) {
    console.error('EXPO_PUBLIC_SUPABASE_URL must start with https:// (localhost will fail on a real phone).');
}

const noopStorage = {
    getItem: (_key: string) => Promise.resolve(null),
    setItem: (_key: string, _value: string) => Promise.resolve(),
    removeItem: (_key: string) => Promise.resolve(),
};

const webStorage =
    typeof window !== 'undefined'
        ? {
              getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
              setItem: (key: string, value: string) => {
                  window.localStorage.setItem(key, value);
                  return Promise.resolve();
              },
              removeItem: (key: string) => {
                  window.localStorage.removeItem(key);
                  return Promise.resolve();
              },
          }
        : noopStorage;

// Use localStorage on browser web; AsyncStorage on native (and RN web fallback).
const ExpoStorage =
    Platform.OS === 'web'
        ? webStorage
        : AsyncStorage;

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        storage: ExpoStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
