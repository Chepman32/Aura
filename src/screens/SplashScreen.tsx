import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../app/navigation/types';
import ShatterText from '../components/splash/ShatterText';
import VortexRing from '../components/splash/VortexRing';
import { requestMediaLibrary } from '../services/permissions';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * Splash screen with shatter → vortex animation sequence.
 * Silently requests photo library permissions during the animation.
 */
export default function SplashScreen({ navigation }: Props): React.JSX.Element {
  const [phase, setPhase] = useState<'idle' | 'shatter' | 'vortex' | 'done'>('idle');

  // Silently request permissions during animation
  useEffect(() => {
    requestMediaLibrary().catch(() => {});
  }, []);

  // Start sequence after short delay
  useEffect(() => {
    const timer = setTimeout(() => setPhase('shatter'), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleShatterComplete = useCallback(() => {
    setPhase('vortex');
  }, []);

  const handleVortexComplete = useCallback(() => {
    setPhase('done');
    navigation.replace('Home');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ShatterText
        shatter={phase === 'shatter' || phase === 'vortex'}
        onShatterComplete={handleShatterComplete}
      />
      <VortexRing
        active={phase === 'vortex'}
        onComplete={handleVortexComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
});
