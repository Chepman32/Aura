export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Editor: { projectId: string };
  Export: { videoUri: string; filterId: string; intensity: number };
  Settings: undefined;
};
