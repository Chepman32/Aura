import { Platform, PermissionsAndroid, type Permission } from 'react-native';
import {
  iosReadGalleryPermission,
  iosRequestReadWriteGalleryPermission,
} from '@react-native-camera-roll/camera-roll';

export type PermissionStatus = 'granted' | 'denied' | 'blocked';

/**
 * Requests access to the device media library (photo/video roll).
 *
 * - iOS: uses CameraRoll's iosRequestReadWriteGalleryPermission()
 * - Android: uses PermissionsAndroid for the appropriate storage permission
 *
 * Returns 'granted' | 'denied' | 'blocked'.
 */
export async function requestMediaLibrary(): Promise<PermissionStatus> {
  if (Platform.OS === 'ios') {
    return requestIosMediaLibrary();
  }
  return requestAndroidMediaLibrary();
}

// ---------------------------------------------------------------------------
// iOS
// ---------------------------------------------------------------------------

async function requestIosMediaLibrary(): Promise<PermissionStatus> {
  try {
    // First check current status
    const currentStatus = await iosReadGalleryPermission('readWrite');

    if (currentStatus === 'granted' || currentStatus === 'limited') {
      return 'granted';
    }

    if (currentStatus === 'denied' || currentStatus === 'blocked') {
      return 'blocked';
    }

    // Not determined — request permission
    const status = await iosRequestReadWriteGalleryPermission();
    return mapIosStatus(status);
  } catch {
    return 'denied';
  }
}

function mapIosStatus(
  status: string | undefined | null,
): PermissionStatus {
  switch (status) {
    case 'granted':
    case 'limited':
      return 'granted';
    case 'denied':
    case 'blocked':
    case 'unavailable':
      return 'blocked';
    default:
      return 'denied';
  }
}

// ---------------------------------------------------------------------------
// Android
// ---------------------------------------------------------------------------

async function requestAndroidMediaLibrary(): Promise<PermissionStatus> {
  const permission = getAndroidPermission();

  try {
    const result = await PermissionsAndroid.request(permission, {
      title: 'Media Library Access',
      message: 'Aura needs access to your videos to apply color grades.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Deny',
      buttonPositive: 'Allow',
    });

    return mapAndroidResult(result);
  } catch {
    return 'denied';
  }
}

function getAndroidPermission(): Permission {
  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(Platform.Version, 10);
  if (apiLevel >= 33) {
    return PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO;
  }
  return PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
}

function mapAndroidResult(result: string): PermissionStatus {
  switch (result) {
    case PermissionsAndroid.RESULTS.GRANTED:
      return 'granted';
    case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
      return 'blocked';
    case PermissionsAndroid.RESULTS.DENIED:
    default:
      return 'denied';
  }
}
