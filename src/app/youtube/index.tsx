import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, CirclePlay, Music2, Upload, type LucideIcon } from 'lucide-react-native';
import { useImportOptions, type ImportOption } from '@/api/blac/importOptions';
import { Card } from '@/components/Card';
import { ScreenState } from '@/components/ScreenState';
import { Text } from '@/components/Text';
import { useArtistStore } from '@/store/artistStore';
import { useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

/** What this version of the app knows about each way of importing. The backend decides which are switched on. */
const KNOWN: Record<string, { Icon: LucideIcon; title: string; description: string; href: Href }> = {
  manual: {
    Icon: Upload,
    title: 'Upload from your phone',
    description: 'Name your songs, then choose an audio file for each.',
    href: '/youtube/manual',
  },
  youtube: {
    Icon: CirclePlay,
    title: 'Import from YouTube',
    description: 'Bring your songs over from your channel.',
    href: '/youtube/connect',
  },
};

function OptionCard({ option }: { option: ImportOption }) {
  const { colors } = useTheme();
  const router = useRouter();
  const known = KNOWN[option.id];
  const Icon = known?.Icon ?? Music2;
  const title = option.title ?? known?.title ?? 'More ways to import';
  const description = option.description ?? known?.description ?? '';
  // Switched on by the server but not something this version of the app can open.
  const usable = option.enabled && !!known;
  const note = usable ? null : (option.note ?? (option.enabled ? 'Update the app to use this' : 'Coming soon'));

  return (
    <Pressable
      onPress={() => {
        if (!usable || !known) return;
        haptics.select();
        router.push(known.href);
      }}
      disabled={!usable}
      accessibilityRole="button"
      accessibilityState={{ disabled: !usable }}
      accessibilityLabel={usable ? title : `${title}. ${note}`}
      style={({ pressed }) => ({ opacity: !usable ? 0.55 : pressed ? 0.8 : 1 })}
    >
      <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
          <Icon size={24} color={usable ? colors.accent : colors.textTertiary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text variant="headline">{title}</Text>
            {note ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.surfaceAlt }}>
                <Text variant="caption" color="textSecondary">
                  {note}
                </Text>
              </View>
            ) : null}
          </View>
          {description ? (
            <Text variant="caption" color="textSecondary">
              {description}
            </Text>
          ) : null}
        </View>
        {usable ? <ChevronRight size={20} color={colors.textTertiary} /> : null}
      </Card>
    </Pressable>
  );
}

/** The start of every import: a list of the ways to bring songs onto Blac, switched on or off by the server. */
export default function ImportSongsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useArtistStore((s) => s.profile);
  const options = useImportOptions();

  // Songs are added under an artist profile.
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="empty"
          title="Create your artist profile first"
          message="Imported songs are added to your artist profile."
          actionLabel="Become an artist"
          onAction={() => router.replace('/become-artist')}
        />
      </View>
    );
  }

  if (options.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (options.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenState
          kind="error"
          title="Can't load the import options"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void options.refetch()}
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 18 }} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 6 }}>
        <Text variant="display">Import songs</Text>
        <Text variant="body" color="textSecondary">
          Choose how you want to bring your music to Blac. More ways are coming.
        </Text>
      </View>
      {options.data.map((option) => (
        <OptionCard key={option.id} option={option} />
      ))}
      <Text variant="caption" color="textTertiary" style={{ textAlign: 'center', paddingHorizontal: 10 }}>
        Only import music you own or have the rights to share.
      </Text>
    </ScrollView>
  );
}
