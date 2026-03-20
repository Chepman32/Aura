export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Editor: { videoUri: string };
  Export: { videoUri: string; filterId: string; intensity: number };
  Settings: undefined;
};
