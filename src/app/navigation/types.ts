export type RootStackParamList = {
  DesignCode: undefined;
  Splash: undefined;
  Home: undefined;
  Editor: { projectId: string };
  Export: {
    videoUri: string;
    filterId: string;
    intensity: number;
    exportFormat: 'mp4' | 'hevc';
  };
  Settings: undefined;
};
