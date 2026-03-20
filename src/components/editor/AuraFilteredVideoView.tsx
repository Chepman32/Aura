import React from 'react';
import {
  requireNativeComponent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

export interface AuraFilteredVideoLoadEvent {
  duration: number;
}

export interface AuraFilteredVideoProgressEvent {
  currentTime: number;
}

export interface AuraFilteredVideoViewProps extends ViewProps {
  sourceUri?: string | null;
  paused: boolean;
  repeatVideo?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  filterMatrix: ReadonlyArray<number>;
  filterMatrixPayload?: string;
  filterIntensity: number;
  style?: StyleProp<ViewStyle>;
  onLoad?: (event: NativeSyntheticEvent<AuraFilteredVideoLoadEvent>) => void;
  onProgress?: (event: NativeSyntheticEvent<AuraFilteredVideoProgressEvent>) => void;
  onEnd?: () => void;
}

const NativeAuraFilteredVideoView =
  requireNativeComponent<AuraFilteredVideoViewProps>('AuraFilteredVideoView');

export default function AuraFilteredVideoView(
  props: AuraFilteredVideoViewProps,
): React.JSX.Element {
  return <NativeAuraFilteredVideoView {...props} />;
}
