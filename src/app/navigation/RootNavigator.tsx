import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppTheme } from '../../theme';
import type { RootStackParamList } from './types';

import SplashScreen from '../../screens/SplashScreen';
import HomeScreen from '../../screens/HomeScreen';
import EditorScreen from '../../screens/EditorScreen';
import ExportScreen from '../../screens/ExportScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import DesignCodeScreen from '../../screens/DesignCodeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.JSX.Element {
  const theme = useAppTheme();
  const colors = theme.colors;

  return (
    <Stack.Navigator
      initialRouteName="DesignCode"
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="DesignCode"
        component={DesignCodeScreen}
        options={{ headerShown: false }}
      />
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
          headerShown: false,
          presentation: 'modal',
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
