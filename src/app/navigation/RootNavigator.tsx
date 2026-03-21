import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme } from '@react-navigation/native';
import { colors } from '../../theme';
import type { RootStackParamList } from './types';

import SplashScreen from '../../screens/SplashScreen';
import HomeScreen from '../../screens/HomeScreen';
import EditorScreen from '../../screens/EditorScreen';
import ExportScreen from '../../screens/ExportScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Extended dark theme that overrides the card background so every
 * screen surface matches our design-system background token.
 */
export const AppDarkTheme: typeof DarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    border: colors.border,
    text: colors.textPrimary,
  },
};

export default function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Editor"
        component={EditorScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Export"
        component={ExportScreen}
        options={{
          headerShown: true,
          title: 'Export',
          presentation: 'modal',
          // Default react-navigation back button on modal.
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: 'Settings',
          // Default react-navigation back button.
          headerBackVisible: true,
        }}
      />
    </Stack.Navigator>
  );
}
