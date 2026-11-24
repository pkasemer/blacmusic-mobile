/** Metro's `require.context` (used to pick up optional font files at build time). */
interface NodeRequire {
  context(
    path: string,
    deep?: boolean,
    filter?: RegExp,
    mode?: 'sync' | 'eager' | 'lazy' | 'lazy-once',
  ): {
    keys(): string[];
    (id: string): number;
  };
}
