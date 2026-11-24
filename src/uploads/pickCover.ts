import { Alert } from 'react-native';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { haptics } from '@/utils/haptics';
import { readable } from './fileSize';

async function fromFiles(): Promise<File | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['image/*'] });
  if (picked.canceled) return null;
  const ok = await readable(picked.result);
  if (!ok) Alert.alert("Can't read that picture", 'Download it to your phone first, then choose it again.');
  return ok;
}

/** Photo library: the system picker needs no permission prompt. The picture is cropped square and saved as JPEG. */
async function fromPhotos(): Promise<File | null> {
  try {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      // Below 1 the picker re-encodes as JPEG, which the backend accepts (iPhone photos are often HEIC).
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return null;
    return new File(picked.assets[0].uri);
  } catch {
    Alert.alert("Can't open your photos", 'Allow Blac to access your photos in Settings, or choose a file instead.');
    return null;
  }
}

/** Asks where the picture is (photo library or Files) and resolves with it, or `null` if the user backs out. */
function choosePicture(title: string): Promise<File | null> {
  haptics.select();
  return new Promise((resolve) => {
    Alert.alert(
      title,
      'Where is the picture?',
      [
        { text: 'Photo library', onPress: () => void fromPhotos().then(resolve) },
        { text: 'Files', onPress: () => void fromFiles().then(resolve) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

export const chooseCover = () => choosePicture('Cover art');
export const chooseAvatar = () => choosePicture('Profile picture');
