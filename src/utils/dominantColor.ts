import { decode as decodeJpeg } from 'jpeg-js';
import UPNG from 'upng-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readImageBytes } from '@/cache/imageCache';

/**
 * Finds the main colours of a cover or profile picture in plain JS, so no native module is needed. Reads PNG
 * and JPEG (the backend serves covers as JPEG).
 *
 * "Main colour" ignores near-white, near-black, grey and transparent pixels: many pictures sit on a white or
 * black background, and that would give no tint at all. Among the coloured pixels it picks the most common
 * colour (16 levels per channel) and averages it. Up to two more colours come from other parts of the picture
 * that are clearly a different hue, so a backdrop can use the picture's own colours instead of invented ones.
 */
const cache = new Map<string, string[] | null>();
const pending = new Map<string, Promise<string[] | null>>();

// The colours of pictures already seen are kept on the phone, so a page does not have to read the picture again
// (and flash from a default colour) the next time the app opens.
const STORE_KEY = 'blac-palette-cache-v1';
const MAX_SAVED = 300;
void AsyncStorage.getItem(STORE_KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as Record<string, string[]>;
    for (const [url, colors] of Object.entries(saved)) if (!cache.has(url)) cache.set(url, colors);
  })
  .catch(() => {});
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const entries = [...cache.entries()].filter((e): e is [string, string[]] => e[1] !== null).slice(-MAX_SAVED);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries))).catch(() => {});
  }, 1500);
}

const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

interface Pixels {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/** Decodes a PNG or JPEG into RGBA pixels, or `null` for a format it does not know. */
function decodePixels(buffer: ArrayBuffer): Pixels | null {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const image = UPNG.decode(buffer);
    return { width: image.width, height: image.height, rgba: new Uint8Array(UPNG.toRGBA8(image)[0]) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const image = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 128 });
    return { width: image.width, height: image.height, rgba: image.data };
  }
  return null;
}

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

/** Hue in degrees (0 to 360) of an RGB colour. */
function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

async function compute(url: string): Promise<string[] | null> {
  // Read from the on-disk image cache when possible, so the picture isn't downloaded a second time.
  const buffer = await readImageBytes(url);

  // Let the UI breathe before the heavy decode.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const pixels = decodePixels(buffer);
  if (!pixels) return null;
  const { width, height, rgba } = pixels;

  // Sample about 6,000 pixels instead of every one.
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 6000)));
  const buckets = new Map<number, Bucket>();

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] < 128) continue;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 510;
      const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      if (lightness > 0.94 || lightness < 0.06 || saturation < 0.25) continue;

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }
  }

  // Most common first. Keep a colour only if its hue is clearly different from those already chosen.
  const ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
  const chosen: { hue: number; hex: string }[] = [];
  for (const bucket of ranked) {
    const r = bucket.r / bucket.count;
    const g = bucket.g / bucket.count;
    const b = bucket.b / bucket.count;
    const hue = hueOf(r, g, b);
    if (chosen.every((c) => hueGap(c.hue, hue) >= 40)) chosen.push({ hue, hex: `#${toHex(r)}${toHex(g)}${toHex(b)}` });
    if (chosen.length === 3) break;
  }
  return chosen.length > 0 ? chosen.map((c) => c.hex) : null;
}

/** Forget every computed colour (used when the image cache is cleared). */
export function clearColorCache() {
  cache.clear();
  AsyncStorage.removeItem(STORE_KEY).catch(() => {});
}

/** Already-computed palette for a picture, if any (`undefined` = not computed yet). The first colour is the main one. */
export const getCachedPalette = (url: string) => cache.get(url);

/** Already-computed main colour for a picture, if any (`undefined` = not computed yet). */
export const getCachedTint = (url: string) => cache.get(url)?.[0] ?? (cache.has(url) ? null : undefined);

/** Up to three colours of the picture at `url` as `#rrggbb`, the main one first; `null` if it has none or cannot be read. */
export function artworkPalette(url: string): Promise<string[] | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null);
  let promise = pending.get(url);
  if (!promise) {
    promise = compute(url)
      .then((colors) => {
        cache.set(url, colors);
        saveSoon();
        return colors;
      })
      .catch(() => null) // network or format problem: not cached, so a later look can retry
      .finally(() => pending.delete(url));
    pending.set(url, promise);
  }
  return promise;
}

/** Main colour of the picture at `url` as `#rrggbb`, or `null` if it has none (or can't be read). */
export async function dominantColor(url: string): Promise<string | null> {
  return (await artworkPalette(url))?.[0] ?? null;
}
