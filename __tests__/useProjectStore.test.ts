jest.mock('../src/services/projectPreview', () => ({
  generateProjectPreview: jest.fn(async ({ projectId }) => `file:///documents/project-previews/${projectId}.jpg`),
  cleanupProjectPreview: jest.fn(async () => {}),
  isGeneratedProjectPreview: jest.fn(() => true),
}));

import { useProjectStore } from '../src/store/useProjectStore';

describe('useProjectStore', () => {
  beforeEach(async () => {
    useProjectStore.getState().reset();
    await (useProjectStore as unknown as { persist?: { clearStorage?: () => Promise<void> } }).persist?.clearStorage?.();
  });

  it('creates, duplicates, trashes, recovers, and permanently removes projects', () => {
    const created = useProjectStore.getState().createProject({
      sourceVideoUri: 'ph://video-1',
      duration: 12,
      filename: 'Summer.mov',
    });

    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(created.name).toBe('Summer');

    const duplicate = useProjectStore.getState().duplicateProject(created.id);
    expect(duplicate?.name).toBe('Summer Copy');
    expect(useProjectStore.getState().projects).toHaveLength(2);

    useProjectStore.getState().removeProject(created.id);
    expect(
      useProjectStore.getState().projects.find((project) => project.id === created.id)?.status,
    ).toBe('trash');
    expect(useProjectStore.getState().trashActivated).toBe(true);

    useProjectStore.getState().recoverProject(created.id);
    expect(
      useProjectStore.getState().projects.find((project) => project.id === created.id)?.status,
    ).toBe('active');

    useProjectStore.getState().removeProject(created.id);
    useProjectStore.getState().removeProjectPermanently(created.id);
    expect(
      useProjectStore.getState().projects.some((project) => project.id === created.id),
    ).toBe(false);
  });

  it('moves projects to folders, uncategorizes them when a folder is removed, and cleans trash', () => {
    const folder = useProjectStore.getState().createFolder('Client');
    const project = useProjectStore.getState().createProject({
      sourceVideoUri: 'ph://video-2',
      duration: 20,
      filename: 'Client Reel.mp4',
    });

    useProjectStore.getState().moveProjectToFolder(project.id, folder.id);
    expect(
      useProjectStore.getState().projects.find((item) => item.id === project.id)?.folderId,
    ).toBe(folder.id);

    useProjectStore.getState().removeFolder(folder.id);
    expect(
      useProjectStore.getState().projects.find((item) => item.id === project.id)?.folderId,
    ).toBeNull();

    useProjectStore.getState().removeProject(project.id);
    expect(
      useProjectStore.getState().projects.filter((item) => item.status === 'trash'),
    ).toHaveLength(1);

    useProjectStore.getState().cleanTrash();
    expect(useProjectStore.getState().projects).toHaveLength(0);
    expect(useProjectStore.getState().trashActivated).toBe(true);
  });
});

