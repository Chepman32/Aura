import { useRef, useCallback } from 'react';
import type { VideoRef } from 'react-native-video';
import { useEditorStore } from '../store/useEditorStore';

interface UseVideoPlayerResult {
  /** Ref to attach to the <Video> component's `ref` prop. */
  videoRef: React.RefObject<VideoRef | null>;
  /** Start playback. */
  play: () => void;
  /** Pause playback. */
  pause: () => void;
  /** Seek to an absolute time in seconds. */
  seek: (time: number) => void;
  /** Toggle between play and pause. */
  toggle: () => void;
  /**
   * Call this from <Video onLoad> to register the video duration.
   * @param duration - Duration in seconds provided by react-native-video.
   */
  onLoad: (duration: number) => void;
  /**
   * Call this from <Video onProgress> to keep the store in sync.
   * @param currentTime - Current playback position in seconds.
   */
  onProgress: (currentTime: number) => void;
  /**
   * Call this from <Video onEnd> to reset playback state.
   */
  onEnd: () => void;
}

/**
 * Wraps a react-native-video ref and keeps useEditorStore in sync.
 *
 * Usage:
 *   const { videoRef, play, pause, seek, toggle, onLoad, onProgress, onEnd }
 *     = useVideoPlayer();
 *
 *   <Video
 *     ref={videoRef}
 *     paused={!isPlaying}
 *     onLoad={({ duration }) => onLoad(duration)}
 *     onProgress={({ currentTime }) => onProgress(currentTime)}
 *     onEnd={onEnd}
 *   />
 */
export function useVideoPlayer(): UseVideoPlayerResult {
  const videoRef = useRef<VideoRef>(null);

  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setDuration = useEditorStore((s) => s.setDuration);

  const play = useCallback(() => {
    setIsPlaying(true);
  }, [setIsPlaying]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  const seek = useCallback(
    (time: number) => {
      videoRef.current?.seek(time);
      setCurrentTime(time);
    },
    [setCurrentTime],
  );

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const onLoad = useCallback(
    (duration: number) => {
      setDuration(duration);
    },
    [setDuration],
  );

  const onProgress = useCallback(
    (currentTime: number) => {
      setCurrentTime(currentTime);
    },
    [setCurrentTime],
  );

  const onEnd = useCallback(() => {
    setIsPlaying(false);
    // Seek back to the start so the video is ready to replay.
    videoRef.current?.seek(0);
    setCurrentTime(0);
  }, [setIsPlaying, setCurrentTime]);

  return {
    videoRef,
    play,
    pause,
    seek,
    toggle,
    onLoad,
    onProgress,
    onEnd,
  };
}
