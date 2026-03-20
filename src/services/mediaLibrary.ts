import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import type { VideoItem } from '../store/useLibraryStore';

const DEFAULT_PAGE_SIZE = 20;

export interface GetVideosResult {
  videos: VideoItem[];
  endCursor: string | null;
  hasNextPage: boolean;
}

/**
 * Fetches a page of videos from the device camera roll.
 *
 * @param cursor   - Opaque pagination cursor returned by a previous call.
 *                   Omit (or pass undefined) to load the first page.
 * @param pageSize - Number of videos to fetch per page. Defaults to 20.
 */
export async function getVideos(
  cursor?: string,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<GetVideosResult> {
  const params: Parameters<typeof CameraRoll.getPhotos>[0] = {
    first: pageSize,
    assetType: 'Videos',
    include: ['filename', 'playableDuration'],
  };

  if (cursor !== undefined) {
    params.after = cursor;
  }

  const result = await CameraRoll.getPhotos(params);

  const videos: VideoItem[] = result.edges.map((edge) => {
    const { node } = edge;

    // uri: use the original local URI
    const uri = node.image.uri;

    // duration in seconds (playableDuration), fall back to 0
    const duration =
      typeof node.image.playableDuration === 'number'
        ? node.image.playableDuration
        : 0;

    // filename: node.image.filename may be undefined in some RN versions
    const filename =
      typeof node.image.filename === 'string' && node.image.filename.length > 0
        ? node.image.filename
        : uri.split('/').pop() ?? 'video';

    return { uri, duration, filename };
  });

  return {
    videos,
    endCursor: result.page_info.end_cursor ?? null,
    hasNextPage: result.page_info.has_next_page,
  };
}
