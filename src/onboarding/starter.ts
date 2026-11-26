/**
 * Mixes several lists of songs into one: it takes from each list in turn so every pick is heard early, lists no song
 * twice, and stops at `length`. Kept on its own so it can be tested.
 */
export function starterTracks<T extends { id: string }>(lists: T[][], length: number, order: (items: T[]) => T[]): T[] {
  const queues = lists.map((items) => order(items));
  const chosen = new Map<string, T>();
  for (let round = 0; chosen.size < length && queues.some((q) => round < q.length); round++) {
    for (const queue of queues) {
      const song = queue[round];
      if (song && chosen.size < length && !chosen.has(song.id)) chosen.set(song.id, song);
    }
  }
  return [...chosen.values()];
}
