import { useEffect, useState } from 'react';
import { Image, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { cacheImage, getCachedFileUri } from '@/cache/imageCache';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Called when the image can't be shown (cache and network both failed). */
  onError?: () => void;
}

/**
 * Image that loads from the on-disk cache and only touches the network the first time.
 * Give it `key={uri}` so a new uri starts fresh.
 *
 * Flow: cached file → show it immediately. Not cached → download into the cache, then show the
 * local file (nothing is drawn until then, so the image is never fetched twice). If the download
 * fails, fall back to loading the remote url directly.
 */
export function CachedImage({ uri, style, resizeMode = 'cover', onError }: Props) {
  const [local, setLocal] = useState<string | null>(() => getCachedFileUri(uri));
  const [downloadFailed, setDownloadFailed] = useState(false);

  useEffect(() => {
    if (local || downloadFailed) return;
    let cancelled = false;
    cacheImage(uri).then((file) => {
      if (cancelled) return;
      if (file) setLocal(file);
      else setDownloadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [uri, local, downloadFailed]);

  const source = local ?? (downloadFailed ? uri : null);
  if (!source) return null;

  return (
    <Image
      source={{ uri: source }}
      style={style}
      resizeMode={resizeMode}
      onError={onError}
      accessibilityIgnoresInvertColors
    />
  );
}
