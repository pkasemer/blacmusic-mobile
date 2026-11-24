# Fonts

RIZFM uses **SF Pro Display** for large titles and **SF Pro Rounded** for everything else.
`src/theme/fonts.ts` picks these files up automatically (no native rebuild needed):

| Role | Files |
| --- | --- |
| SF Pro Display (titles) | `SF-Pro-Display-Semibold.otf`, `SF-Pro-Display-Bold.otf` |
| SF Pro Rounded (UI text) | `SF-Pro-Rounded-Regular.otf`, `-Medium.otf`, `-Semibold.otf`, `-Bold.otf` |

A missing file falls back to the system font, so nothing breaks.

**Licence note:** Apple's SF fonts are licensed for apps on Apple platforms. These files came from a
third-party mirror of Apple's fonts. For a public release, use the copies from
<https://developer.apple.com/fonts/> and review Apple's licence, especially if you ship on Android.
