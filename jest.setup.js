/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () => ({}));

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');

  const interpolate = (value, input, output) => {
    if (!Array.isArray(input) || !Array.isArray(output) || input.length < 2 || output.length < 2) {
      return value;
    }

    const [inputStart, inputEnd] = input;
    const [outputStart, outputEnd] = output;

    if (inputEnd === inputStart) {
      return outputStart;
    }

    const progress = (value - inputStart) / (inputEnd - inputStart);
    return outputStart + (outputEnd - outputStart) * progress;
  };

  const createAnimatedComponent = (Component) => Component;

  const Animated = {
    View: ReactNative.View,
    Text: ReactNative.Text,
    ScrollView: ReactNative.ScrollView,
    createAnimatedComponent,
  };

  return {
    __esModule: true,
    default: Animated,
    View: ReactNative.View,
    Text: ReactNative.Text,
    ScrollView: ReactNative.ScrollView,
    createAnimatedComponent,
    useSharedValue: (value) => ({ value }),
    useDerivedValue: (factory) => ({
      value: typeof factory === 'function' ? factory() : factory,
    }),
    useAnimatedStyle: (factory) => (typeof factory === 'function' ? factory() : {}),
    useAnimatedProps: (factory) => (typeof factory === 'function' ? factory() : {}),
    useAnimatedReaction: () => {},
    useAnimatedScrollHandler: () => jest.fn(),
    withSpring: (value, _config, callback) => {
      if (typeof callback === 'function') {
        callback(true);
      }
      return value;
    },
    withTiming: (value, _config, callback) => {
      if (typeof callback === 'function') {
        callback(true);
      }
      return value;
    },
    withDelay: (_delay, value) => value,
    withRepeat: (value) => value,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: () => {},
    interpolate,
    interpolateColor: (_value, _input, output) =>
      Array.isArray(output) && output.length > 0 ? output[0] : '#000000',
    runOnJS: (fn) => fn,
    Easing: {
      ease: (value) => value,
      out: (fn) => fn,
      in: (fn) => fn,
      inOut: (fn) => fn,
    },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const createGesture = () => ({
    minDuration: () => createGesture(),
    onStart: () => createGesture(),
    onUpdate: () => createGesture(),
    onEnd: () => createGesture(),
    onFinalize: () => createGesture(),
  });

  return {
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: ({ children }) => children,
    Gesture: {
      LongPress: createGesture,
      Tap: createGesture,
      Pan: createGesture,
      Exclusive: (...gestures) => gestures,
      Simultaneous: (...gestures) => gestures,
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaConsumer: ({ children }) => children({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-native-community/blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('@react-native-menu/menu', () => {
  const React = require('react');

  const MenuView = ({ children }) => <>{children}</>;
  MenuView.displayName = 'MenuView';

  return { MenuView };
});

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    getPhotos: jest.fn(async () => ({
      edges: [],
      page_info: {
        end_cursor: null,
        has_next_page: false,
      },
    })),
    saveAsset: jest.fn(async () => 'mock-asset-id'),
  },
  iosReadGalleryPermission: jest.fn(async () => 'granted'),
  iosRequestReadWriteGalleryPermission: jest.fn(async () => 'granted'),
}));

jest.mock('react-native-fs', () => {
  const files = new Map();

  return {
    DocumentDirectoryPath: '/documents',
    TemporaryDirectoryPath: '/tmp',
    MainBundlePath: '/bundle',
    exists: jest.fn(async (path) => files.has(path)),
    readFile: jest.fn(async (path) => files.get(path) ?? ''),
    writeFile: jest.fn(async (path, value) => {
      files.set(path, value);
    }),
    mkdir: jest.fn(async () => {}),
    unlink: jest.fn(async (path) => {
      files.delete(path);
    }),
    readDir: jest.fn(async () => []),
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
  HapticFeedbackTypes: {
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
  },
}));

jest.mock('react-native-video', () => 'Video');

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Circle: 'Circle',
  BlurMask: 'BlurMask',
  RoundedRect: 'RoundedRect',
  Line: 'Line',
  Rect: 'Rect',
  vec: (x, y) => ({ x, y }),
}));
