/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/app/navigation/RootNavigator', () => {
  const ReactMock = require('react');
  return {
    __esModule: true,
    default: () => ReactMock.createElement('RootNavigator'),
    AppDarkTheme: { dark: true, colors: {} },
  };
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
