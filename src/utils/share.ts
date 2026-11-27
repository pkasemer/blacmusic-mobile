import { Platform, Share } from 'react-native';

/**
 * Opens the system share sheet with a message and its link, the link once. iPhone adds `url` after the message by
 * itself, so it must not be in the message too; Android ignores `url`, so there the message has to carry it.
 */
export async function shareLink(message: string, url: string): Promise<void> {
  try {
    await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` });
  } catch {
    // The share sheet failing to open is not worth an error.
  }
}
