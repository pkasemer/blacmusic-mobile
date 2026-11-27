import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Switch, TextInput, View } from 'react-native';
import { Check, Globe, Lock, Plus } from 'lucide-react-native';
import { artistLine } from '@/domain/artists';
import { blacApi } from '@/api/blac';
import { refreshPlaylistQueries } from '@/api/blac/playlistCache';
import { useMyPlaylistsFor } from '@/api/blac/queries';
import type { Playlist, Track } from '@/domain/types';
import { recordPlaylistAdd } from '@/stats/signals';
import { showToast } from '@/store/toastStore';
import { radius, useTheme } from '@/theme';
import { fontStyle } from '@/theme/fonts';
import { haptics } from '@/utils/haptics';
import { BottomSheet } from './BottomSheet';
import { PlaylistCover } from './PlaylistCover';
import { Text } from './Text';

const visibilityText = (isPublic: boolean) => (isPublic ? 'Public' : 'Private');

function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  autoFocus,
  maxLength,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoFocus?: boolean;
  maxLength: number;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      autoFocus={autoFocus}
      multiline={multiline}
      maxLength={maxLength}
      style={{
        ...fontStyle('rounded', '400'),
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.sm,
        paddingHorizontal: 14,
        paddingVertical: 12,
        ...(multiline ? { minHeight: 72, textAlignVertical: 'top' as const } : null),
      }}
    />
  );
}

/**
 * The form for a playlist: a name, an optional description and whether it is public. Playlists are private unless
 * you turn "Public" on; public ones can be found in search. With `playlist` it edits that one (and can delete it).
 * `onDone` gets the saved playlist; `onDeleted` runs after a delete.
 */
function PlaylistForm({
  playlist,
  dismiss,
  onDone,
  onDeleted,
}: {
  playlist?: Playlist;
  dismiss: (after?: () => void) => void;
  onDone?: (playlist: Playlist) => void;
  onDeleted?: () => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(playlist?.name ?? '');
  const [description, setDescription] = useState(playlist?.description ?? '');
  const [isPublic, setIsPublic] = useState(playlist?.isPublic ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = name.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const saved = playlist
        ? await blacApi.updatePlaylist(playlist.id, { name, description, isPublic })
        : await blacApi.createPlaylist({ name, description, isPublic });
      refreshPlaylistQueries(saved.id);
      haptics.success();
      dismiss(() => onDone?.(saved));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      haptics.error();
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!playlist) return;
    haptics.warning();
    Alert.alert('Delete this playlist?', 'The songs stay in Blac. Only the playlist is removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await blacApi.deletePlaylist(playlist.id);
            refreshPlaylistQueries(playlist.id);
            showToast('Playlist deleted');
            dismiss(() => onDeleted?.());
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ paddingHorizontal: 20, gap: 14 }}>
      <Text variant="title">{playlist ? 'Edit playlist' : 'New playlist'}</Text>
      <Field value={name} onChangeText={setName} placeholder="Playlist name" autoFocus={!playlist} maxLength={100} />
      <Field value={description} onChangeText={setDescription} placeholder="Description (optional)" multiline maxLength={500} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Make public</Text>
          <Text variant="caption" color="textSecondary">
            {isPublic ? 'Anyone on Blac can find it in search.' : 'Only you can see it.'}
          </Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={(v) => {
            haptics.select();
            setIsPublic(v);
          }}
          trackColor={{ false: colors.borderStrong, true: colors.accent }}
          ios_backgroundColor={colors.borderStrong}
        />
      </View>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignItems: 'center',
          paddingVertical: 15,
          borderRadius: radius.pill,
          backgroundColor: colors.primary,
          opacity: !canSave ? 0.4 : pressed ? 0.85 : 1,
        })}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text variant="bodyStrong" color="onPrimary">
            {playlist ? 'Save' : 'Create'}
          </Text>
        )}
      </Pressable>

      {playlist ? (
        <Pressable onPress={confirmDelete} accessibilityRole="button" style={{ alignItems: 'center', padding: 8 }}>
          <Text variant="body" color="danger">
            Delete playlist
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Sheet to make a playlist, or (with `playlist`) to edit or delete one. */
export function PlaylistFormSheet({
  visible,
  onClose,
  playlist,
  onDone,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  playlist?: Playlist;
  onDone?: (playlist: Playlist) => void;
  onDeleted?: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {(dismiss) => <PlaylistForm playlist={playlist} dismiss={dismiss} onDone={onDone} onDeleted={onDeleted} />}
    </BottomSheet>
  );
}

function PickerRow({ playlist, onPress }: { playlist: Playlist; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${playlist.name}${playlist.containsTrack ? ', already added' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <PlaylistCover playlist={playlist} size={48} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="headline" numberOfLines={1}>
          {playlist.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {playlist.isPublic ? <Globe size={12} color={colors.textTertiary} /> : <Lock size={12} color={colors.textTertiary} />}
          <Text variant="caption" color="textSecondary">
            {visibilityText(playlist.isPublic)} · {playlist.trackCount} {playlist.trackCount === 1 ? 'song' : 'songs'}
          </Text>
        </View>
      </View>
      {playlist.containsTrack ? <Check size={20} color={colors.accent} /> : null}
    </Pressable>
  );
}

function AddToPlaylist({ track, dismiss }: { track: Track; dismiss: (after?: () => void) => void }) {
  const { colors } = useTheme();
  const query = useMyPlaylistsFor(track.id);
  const [creating, setCreating] = useState(false);

  const add = async (playlist: Playlist) => {
    try {
      await blacApi.addToPlaylist(playlist.id, track.id);
      recordPlaylistAdd(track.id, playlist.id);
      refreshPlaylistQueries(playlist.id);
      haptics.success();
      dismiss(() => showToast(`Added to ${playlist.name}`));
    } catch (e) {
      haptics.error();
      Alert.alert("Couldn't add it", e instanceof Error ? e.message : 'Try again.');
    }
  };

  const choose = (playlist: Playlist) => {
    if (!playlist.containsTrack) {
      void add(playlist);
      return;
    }
    Alert.alert('Already in this playlist', `"${track.title}" is already in ${playlist.name}. Add it again?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add again', onPress: () => void add(playlist) },
    ]);
  };

  if (creating) {
    return (
      <PlaylistForm
        dismiss={dismiss}
        onDone={(created) => {
          // A playlist made from a song's menu starts with that song in it.
          blacApi
            .addToPlaylist(created.id, track.id)
            .then(() => {
              recordPlaylistAdd(track.id, created.id);
              refreshPlaylistQueries(created.id);
              showToast(`Added to ${created.name}`);
            })
            .catch(() => showToast(`Made ${created.name}, but couldn't add the song`));
        }}
      />
    );
  }

  const playlists = query.data ?? [];
  return (
    <View style={{ gap: 6 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
        <Text variant="title">Add to playlist</Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {track.title} · {artistLine(track)}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          haptics.select();
          setCreating(true);
        }}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 8,
          paddingHorizontal: 20,
          backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
        })}
      >
        <View style={{ width: 48, height: 48, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
          <Plus size={22} color={colors.accent} />
        </View>
        <Text variant="headline">New playlist</Text>
      </Pressable>

      {query.isPending ? (
        <ActivityIndicator color={colors.accent} style={{ paddingVertical: 24 }} />
      ) : query.isError ? (
        <Text variant="body" color="textSecondary" style={{ padding: 20 }}>
          {"Couldn't load your playlists. Check your connection and try again."}
        </Text>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PickerRow playlist={item} onPress={() => choose(item)} />}
          style={{ maxHeight: 360 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

/** Sheet that lists your playlists so a song can be added to one, or to a new one. `track` is `null` when closed. */
export function AddToPlaylistSheet({ track, onClose }: { track: Track | null; onClose: () => void }) {
  return <BottomSheet visible={track !== null} onClose={onClose}>{(dismiss) => (track ? <AddToPlaylist track={track} dismiss={dismiss} /> : null)}</BottomSheet>;
}

