# Blac

Blac Music: music and podcast streaming. Expo (development build) · Expo Router · Zustand · TanStack Query · expo-audio.

The app shell (native tabs, mini and full player, lock-screen and notification controls, favourites, image cache,
sleep timer, light and dark themes) was ported from the RIZFM radio app. All radio code and the RIZFM API are gone:
Home, Search, Library, the player and Studio now run on the Blac backend (`src/api/blac`). Without a backend address, a
production build uses built-in sample data; a development build talks to the backend on the computer running Metro.
Point at a specific server with `EXPO_PUBLIC_BLAC_API_URL` (or `mock` for sample data).

## Run

```bash
npm install
npx expo run:android   # or: npx expo run:ios   (development build, not Expo Go)
npx expo start --dev-client
```

Background audio, lock-screen controls and cleartext (`http://`) streams need a native build, so Expo Go will not work.

## Variants

`app.config.js` builds two installable variants from `APP_VARIANT` (set by the EAS profiles in `eas.json`):
production `Blac` (`com.blac.music`, `blac://`) and development `Blac Dev` (`com.blac.music.dev`, `blac-dev://`).
No EAS project or owner is linked yet; run `npx eas-cli init` to create one for Blac.

## Design

Spotify-style dark: `#121212` page, `#181818` cards, `#282828` raised surfaces, white text with neutral greys.
Accent is the Blac logo purple `#BB88FF` (a deeper `#7B3FE4` for small text and icons in light mode).
All tokens are in `src/theme/index.ts`.

## Layout

| Path | What |
| --- | --- |
| `src/app` | Expo Router routes: tabs `index` (Home), `search`, `library`, `studio` (artists only), `settings`; `sign-in`, `verify-email`, `become-artist`, `podcast/[id]`, `release/new`, `release/[id]` |
| `src/domain` | Blac data model: tracks, episodes, artists, quota, downloads |
| `src/api/blac` | `BlacApi` interface, HTTP client, sample-data mock and query hooks |
| `src/audio/music` | on-demand player (expo-audio `AudioPlaylist`): queue, shuffle, repeat, seek |
| `src/offline` | download manager (app-private files; encryption and backup exclusion still to do) |
| `src/store` | Zustand: `music` (queue), `sleep`, `auth`, `upload`, persisted `favourites`, `history`, `downloads`, `settings` |
| `src/audio` | sleep timer and audio mode; the player itself is in `audio/music` |
| `src/cache` | persistent on-disk image cache |
| `src/components` | mini/full player, backdrop, sheets, cards, skeletons |
| `src/theme` | colour, type and ink tokens |
