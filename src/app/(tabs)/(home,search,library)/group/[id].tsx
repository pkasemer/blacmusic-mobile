import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaylistGroup } from '@/api/blac/queries';
import { PlaylistCover } from '@/components/PlaylistCover';
import { ScreenState } from '@/components/ScreenState';
import { TabScreen } from '@/components/TabScreen';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';

const GAP = 14;
const SIDE = 20;

/** "See all" for a Home group such as "Workout": every playlist in it, two to a row. */
export default function PlaylistGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const query = usePlaylistGroup(id);
  const group = query.data;

  if (query.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Couldn't open this group"
          message="It may have been removed, or you may be offline."
          actionLabel="Try again"
          onAction={() => void query.refetch()}
        />
      </View>
    );
  }

  return (
    <TabScreen>
      <Stack.Screen options={{ title: group.title }} />
      <FlatList
        data={group.playlists}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: SIDE }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 40, gap: 22 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: SIDE, paddingBottom: 6, gap: 4 }}>
            <Text variant="display" numberOfLines={2}>
              {group.title}
            </Text>
            {group.description ? (
              <Text variant="body" color="textSecondary">
                {group.description}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open playlist ${item.name}`}
            style={({ pressed }) => ({ flex: 1, gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <PlaylistCover playlist={item} size={156} />
            <View style={{ gap: 1 }}>
              <Text variant="headline" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {item.ownerName ? `By ${item.ownerName}` : `${item.trackCount} ${item.trackCount === 1 ? 'song' : 'songs'}`}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </TabScreen>
  );
}
