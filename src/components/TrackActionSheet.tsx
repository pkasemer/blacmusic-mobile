import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Download, Heart, ListEnd, ListMinus, ListPlus, Radio, Share2, UserRound } from 'lucide-react-native';
import { addToQueue } from '@/audio/music/musicEngine';
import { queuedAhead } from '@/audio/music/queue';
import { startMix } from '@/audio/music/startMix';
import type { Track } from '@/domain/types';
import { cancelDownload, downloadBlockReason, downloadItem } from '@/offline/downloads';
import { useDownload } from '@/store/downloadStore';
import { useFavouritesStore, useIsFavourite } from '@/store/favouritesStore';
import { useMusicStore } from '@/store/musicStore';
import { radius, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Artwork } from './Artwork';
import { AddToPlaylistSheet } from './PlaylistSheets';
import { ArtistName } from './ArtistName';
import { Text } from './Text';

const CLOSE_MS = 200;

function ActionRow({
  icon,
  label,
  detail,
  onPress,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        minHeight: 54,
        paddingHorizontal: 20,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 26, alignItems: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontSize: 16 }}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" color="textSecondary">
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The "more" menu for one song, as a sheet that slides up from the bottom: add to the queue, favourite, download,
 * share, go to the artist and start a mix from it. `track` is the song to show it for, or `null` for closed.
 */
function TrackActionSheet({
  track,
  options,
  onClose,
  onAddToPlaylist: openAddToPlaylist,
}: {
  track: Track | null;
  options?: TrackMenuOptions;
  onClose: () => void;
  onAddToPlaylist: (track: Track) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [mixBusy, setMixBusy] = useState(false);
  const id = track?.id ?? '';
  const favourite = useIsFavourite(id);
  const toggleFavourite = useFavouritesStore((s) => s.toggle);
  const download = useDownload(id);
  /** How many queued songs would play before this one. `null` when nothing is playing. */
  const queuedBefore = useMusicStore((s) => (s.active ? queuedAhead(s.queue, s.index, s.waiting).length : null));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Slides the sheet away, then closes it and runs `after` (for things that open another screen or sheet). */
  const dismiss = (after?: () => void) => {
    setClosing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onClose();
      setClosing(false);
      after?.();
    }, CLOSE_MS);
  };

  if (!track) return <Modal visible={false} transparent />;

  const blocked = downloadBlockReason(track);
  const downloaded = download?.state === 'done';
  const downloading = download?.state === 'queued' || download?.state === 'downloading';

  const onQueue = () => {
    addToQueue(track);
    dismiss();
  };

  const onFavourite = () => {
    const added = toggleFavourite(track.id);
    if (added) haptics.success();
    else haptics.light();
    dismiss();
  };

  const onDownload = () => {
    if (downloaded || downloading) {
      cancelDownload(track.id);
      haptics.light();
    } else if (!blocked) {
      downloadItem(track);
    }
    dismiss();
  };

  const onAddToPlaylist = () => {
    haptics.select();
    dismiss(() => openAddToPlaylist(track));
  };

  const onRemove = () => {
    haptics.warning();
    dismiss(() => options?.onRemove?.());
  };

  const onShare = () => {
    haptics.select();
    const url = Linking.createURL(`/track/${track.id}`);
    dismiss(() => {
      Share.share({ message: `Listen to "${track.title}" by ${track.artistName} on Blac\n${url}`, url }).catch(() => {});
    });
  };

  const onArtist = () => {
    haptics.select();
    dismiss(() => {
      options?.onNavigate?.();
      router.push({ pathname: '/artist/[id]', params: { id: track.artistId } });
    });
  };

  const onMix = async () => {
    haptics.select();
    setMixBusy(true);
    const started = await startMix(track);
    setMixBusy(false);
    // The mix is playing: close the menu and show what is in it.
    if (started) {
      dismiss(() => {
        options?.onNavigate?.();
        router.push({ pathname: '/mix/[id]', params: { id: track.id } });
      });
    }
  };

  const iconColor = colors.text;

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => dismiss()} statusBarTranslucent>
      {!closing ? (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View
            entering={FadeIn.duration(CLOSE_MS)}
            exiting={FadeOut.duration(CLOSE_MS)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => dismiss()} accessibilityLabel="Close menu" accessibilityRole="button" />
          </Animated.View>

          <Animated.View
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(CLOSE_MS)}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: colors.border,
              paddingTop: 10,
              paddingBottom: insets.bottom + 12,
            }}
          >
            <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 }} />

            {/* Which song this is for */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 14 }}>
              <Artwork id={track.id} logoUrl={track.artworkUrl} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="headline" numberOfLines={1}>
                  {track.title}
                </Text>
                <ArtistName name={track.artistName} verified={track.artistVerified} />
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 6 }} />

            <ActionRow
              icon={<ListEnd size={22} color={iconColor} />}
              label="Add to queue"
              detail={
                queuedBefore === null
                  ? 'Starts playing now'
                  : queuedBefore === 0
                    ? 'Plays after this song'
                    : `Plays after the ${queuedBefore === 1 ? 'song' : `${queuedBefore} songs`} you already queued`
              }
              onPress={onQueue}
            />
            <ActionRow
              icon={mixBusy ? <ActivityIndicator size="small" color={colors.accent} /> : <Radio size={22} color={iconColor} />}
              label={mixBusy ? 'Making your mix…' : 'Start mix'}
              detail="Plays songs like this one"
              onPress={onMix}
              disabled={mixBusy}
            />
            <ActionRow
              icon={<Heart size={22} color={favourite ? colors.accent : iconColor} fill={favourite ? colors.accent : 'none'} />}
              label={favourite ? 'Remove from likes' : 'Add to likes'}
              onPress={onFavourite}
            />
            <ActionRow icon={<ListPlus size={22} color={iconColor} />} label="Add to playlist" onPress={onAddToPlaylist} />
            {options?.onRemove ? (
              <ActionRow icon={<ListMinus size={22} color={colors.danger} />} label={options.removeLabel ?? 'Remove from this playlist'} onPress={onRemove} />
            ) : null}
            <ActionRow
              icon={
                downloading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : downloaded ? (
                  <CircleCheck size={22} color={colors.accent} />
                ) : (
                  <Download size={22} color={iconColor} />
                )
              }
              label={downloaded ? 'Downloaded' : downloading ? 'Downloading…' : 'Download'}
              detail={downloaded || downloading ? 'Tap to remove' : (blocked ?? undefined)}
              onPress={onDownload}
              disabled={!!blocked && !download}
            />
            <ActionRow icon={<Share2 size={22} color={iconColor} />} label="Share" onPress={onShare} />
            {track.artistId ? <ActionRow icon={<UserRound size={22} color={iconColor} />} label="Go to artist" detail={track.artistName} onPress={onArtist} /> : null}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

/** Extra things a screen can add to the menu for the song it opened. */
export interface TrackMenuOptions {
  /** Shows a red "Remove from this playlist" row that runs this. */
  onRemove?: () => void;
  /** Runs just before the menu opens another page (the full player uses it to close itself first). */
  onNavigate?: () => void;
  removeLabel?: string;
}

/**
 * Hook for the three-dots menu: `menu.open(track)` from a row's "more" button, and render `menu.sheet` once
 * anywhere in the screen. It also hosts the "Add to playlist" sheet the menu leads to.
 */
export function useTrackMenu(): { open: (track: Track, options?: TrackMenuOptions) => void; sheet: ReactElement } {
  const [open, setOpen] = useState<{ track: Track; options?: TrackMenuOptions } | null>(null);
  const [adding, setAdding] = useState<Track | null>(null);
  return {
    open: (track, options) => setOpen({ track, options }),
    sheet: (
      <>
        <TrackActionSheet track={open?.track ?? null} options={open?.options} onClose={() => setOpen(null)} onAddToPlaylist={setAdding} />
        <AddToPlaylistSheet track={adding} onClose={() => setAdding(null)} />
      </>
    ),
  };
}
