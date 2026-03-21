import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import EditorScreen from '../src/screens/EditorScreen';
import type { RootStackParamList } from '../src/app/navigation/types';
import { useEditorStore } from '../src/store/useEditorStore';
import { useProjectStore } from '../src/store/useProjectStore';

jest.mock('../src/components/editor/VideoViewport', () => 'VideoViewport');
jest.mock('../src/components/editor/AuraRibbon', () => 'AuraRibbon');
jest.mock('../src/components/editor/IntensitySlider', () => 'IntensitySlider');

type EditorProps = NativeStackScreenProps<RootStackParamList, 'Editor'>;

describe('EditorScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useEditorStore.getState().reset();
    useProjectStore.getState().reset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('hydrates editor state from projectId and refreshes previews on blur', async () => {
    const updateProjectSession = jest.fn();
    const refreshProjectPreview = jest.fn(async () => {});
    const listeners: Record<string, () => void> = {};

    useProjectStore.setState({
      projects: [
        {
          id: 'project-1',
          name: 'Demo',
          sourceVideoUri: 'ph://demo',
          duration: 42,
          folderId: null,
          previousFolderId: null,
          status: 'active',
          previewUri: 'ph://demo',
          previewTimeMs: 2500,
          filterId: 'cinematic',
          filterIntensity: 0.7,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      updateProjectSession,
      refreshProjectPreview,
    });

    const navigation = {
      navigate: jest.fn(),
      addListener: jest.fn((event: string, callback: () => void) => {
        listeners[event] = callback;
        return () => {
          delete listeners[event];
        };
      }),
    } as unknown as EditorProps['navigation'];

    const route = {
      key: 'Editor-project-1',
      name: 'Editor',
      params: { projectId: 'project-1' },
    } as EditorProps['route'];

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <EditorScreen route={route} navigation={navigation} />,
      );
    });

    expect(useEditorStore.getState().currentVideoUri).toBe('ph://demo');
    expect(useEditorStore.getState().activeFilterId).toBe('cinematic');
    expect(useEditorStore.getState().filterIntensity).toBe(0.7);
    expect(useEditorStore.getState().currentTime).toBe(2.5);

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(updateProjectSession).toHaveBeenCalledWith('project-1', {
      filterId: 'cinematic',
      filterIntensity: 0.7,
      previewTimeMs: 2500,
    });

    await ReactTestRenderer.act(async () => {
      listeners.blur?.();
    });

    expect(refreshProjectPreview).toHaveBeenCalledWith('project-1', {
      timeMs: 2500,
      sourceVideoUri: 'ph://demo',
      filterId: 'cinematic',
      filterIntensity: 0.7,
    });
  });
});
