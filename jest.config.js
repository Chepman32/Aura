module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-navigation|react-native-reanimated|react-native-worklets|@react-native-menu/menu)/)',
  ],
};
