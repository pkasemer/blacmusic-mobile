import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { ApiError } from './http';
import { isOpenTransfer, youtubeApi, type Transfer } from './youtube';

export const youtubeKeys = {
  connection: ['youtube', 'connection'] as const,
  videos: ['youtube', 'videos'] as const,
  transfer: (id: string) => ['youtube', 'transfer', id] as const,
  transfers: ['youtube', 'transfers'] as const,
};

/** Is a YouTube channel connected, and does the connection need renewing? */
export const useYouTubeConnection = () =>
  useQuery({ queryKey: youtubeKeys.connection, queryFn: () => youtubeApi.getConnection(), retry: false, staleTime: 30_000 });

/** The songs found on the connected channel (the first call reads the channel, which can take a few seconds). */
export const useYouTubeVideos = (enabled: boolean) =>
  useQuery({ queryKey: youtubeKeys.videos, queryFn: () => youtubeApi.getVideos(), enabled, retry: false, staleTime: 60_000 });

/** How often to ask the server about a transfer: fast while it works, slowly while it waits, never when it is over. */
export function transferPollMs(transfer: Transfer | undefined): number | false {
  if (!transfer) return false;
  switch (transfer.status) {
    case 'in_progress':
      return 2000;
    case 'collecting':
      return 4000;
    case 'queued':
    case 'retrying':
      // Songs being fetched from YouTube change state quickly (and may need a file when a fetch fails).
      return transfer.items?.some((i) => i.status === 'fetching') ? 4000 : 12_000;
    default:
      return false;
  }
}

/** One transfer, kept fresh while the screen is open. The server owns it, so this also rebuilds it after the app restarts. */
export const useTransfer = (id: string) =>
  useQuery({
    queryKey: youtubeKeys.transfer(id),
    queryFn: () => youtubeApi.getTransfer(id),
    enabled: !!id,
    refetchInterval: (query) => transferPollMs(query.state.data),
    retry: 1,
  });

/** The transfer that is still going on, if any (an artist has at most one), so Studio can offer to resume it. */
export const useActiveTransfer = (enabled = true) =>
  useQuery({
    queryKey: youtubeKeys.transfers,
    queryFn: async () => (await youtubeApi.listTransfers()).find(isOpenTransfer) ?? null,
    enabled,
    retry: false,
    refetchInterval: (query) => (query.state.data ? 15_000 : false),
    staleTime: 10_000,
  });

/** Puts a transfer the server just sent back into the cache, so the screen updates without waiting for the next poll. */
export function setTransferInCache(transfer: Transfer) {
  queryClient.setQueryData(youtubeKeys.transfer(transfer.id), transfer);
  void queryClient.invalidateQueries({ queryKey: youtubeKeys.transfers });
}

/** A sentence for an error from the YouTube endpoints. */
export function youtubeErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'youtube_unavailable':
        return "YouTube import isn't switched on yet. It will be available soon.";
      case 'youtube_not_connected':
        return 'Connect your YouTube channel first.';
      case 'reconnect_required':
        return 'YouTube stopped allowing access. Connect again to continue.';
      case 'youtube_quota':
        return "Google's daily limit for YouTube requests has been reached. Try again later.";
      case 'youtube_error':
        return "YouTube didn't answer. Try again in a moment.";
      case 'artist_required':
        return 'Create an artist profile first.';
      case 'transfer_active':
        return 'You already have a transfer going. Finish or cancel it first.';
      case 'audio_missing':
        return 'Some songs still need their audio.';
      case 'no_audio':
        return 'Add audio for at least one song first.';
      case 'import_disabled':
        return "That way of importing isn't available right now.";
      case 'busy':
        return 'That file is being processed right now. Try again in a moment.';
      case 'rights_not_accepted':
        return 'Confirm that you own the rights to these songs first.';
      case 'wrong_state':
        return "That can't be done at this stage of the transfer.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

/** The codes that mean "the user has to connect (again)", rather than "something broke". */
export const needsConnect = (error: unknown) =>
  error instanceof ApiError && (error.code === 'youtube_not_connected' || error.code === 'reconnect_required');
