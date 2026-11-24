import { queryClient } from '@/api/queryClient';
import { musicKeys } from './queries';

/** After a playlist is made, changed or deleted, or a song is added or removed: refresh every list that shows playlists. */
export function refreshPlaylistQueries(playlistId?: string) {
  void queryClient.invalidateQueries({ queryKey: musicKeys.playlists });
  void queryClient.invalidateQueries({ queryKey: musicKeys.myPlaylists });
  void queryClient.invalidateQueries({ queryKey: ['music', 'my-playlists-for'] });
  void queryClient.invalidateQueries({ queryKey: ['music', 'search-playlists'] });
  if (playlistId) void queryClient.invalidateQueries({ queryKey: musicKeys.playlist(playlistId) });
}
