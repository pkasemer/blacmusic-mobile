declare module 'upng-js' {
  export interface DecodedPng {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: unknown[];
    tabs: Record<string, unknown>;
    data: ArrayBuffer;
  }
  const UPNG: {
    decode(buffer: ArrayBuffer): DecodedPng;
    /** One RGBA8 buffer per animation frame. */
    toRGBA8(image: DecodedPng): ArrayBuffer[];
  };
  export default UPNG;
}
