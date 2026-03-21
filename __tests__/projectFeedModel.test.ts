import {
  ALL_PROJECTS_SECTION_ID,
  buildProjectFeedItems,
  buildProjectSections,
  TRASH_SECTION_ID,
} from '../src/components/home/projectFeedModel';
import type { Folder, Project } from '../src/store/useProjectStore';

const folders: Folder[] = [
  { id: 'folder-a', name: 'Folder A', createdAt: 10 },
  { id: 'folder-b', name: 'Folder B', createdAt: 20 },
];

const projects: Project[] = [
  {
    id: 'project-1',
    name: 'One',
    sourceVideoUri: 'ph://1',
    duration: 10,
    folderId: 'folder-a',
    previousFolderId: 'folder-a',
    status: 'active',
    previewUri: 'ph://1',
    previewTimeMs: 0,
    filterId: 'original',
    filterIntensity: 1,
    createdAt: 10,
    updatedAt: 30,
  },
  {
    id: 'project-2',
    name: 'Two',
    sourceVideoUri: 'ph://2',
    duration: 15,
    folderId: null,
    previousFolderId: null,
    status: 'active',
    previewUri: 'ph://2',
    previewTimeMs: 0,
    filterId: 'original',
    filterIntensity: 1,
    createdAt: 20,
    updatedAt: 40,
  },
  {
    id: 'project-3',
    name: 'Three',
    sourceVideoUri: 'ph://3',
    duration: 8,
    folderId: null,
    previousFolderId: null,
    status: 'trash',
    previewUri: 'ph://3',
    previewTimeMs: 0,
    filterId: 'original',
    filterIntensity: 1,
    createdAt: 30,
    updatedAt: 50,
  },
];

describe('projectFeedModel', () => {
  it('orders sections with All Projects first, folders by creation order, and Trash last', () => {
    const sections = buildProjectSections({
      folders,
      projects,
      trashActivated: true,
      expandedSections: {
        [ALL_PROJECTS_SECTION_ID]: true,
        'folder-a': true,
        'folder-b': false,
        [TRASH_SECTION_ID]: false,
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      'All Projects',
      'Folder A',
      'Folder B',
      'Trash',
    ]);
    expect(sections[0].projects.map((project) => project.id)).toEqual([
      'project-2',
      'project-1',
    ]);
    expect(sections[0].projects.some((project) => project.status === 'trash')).toBe(false);
  });

  it('builds accordion feed items with empty sections and grid rows', () => {
    const sections = buildProjectSections({
      folders,
      projects,
      trashActivated: true,
      expandedSections: {
        [ALL_PROJECTS_SECTION_ID]: true,
        'folder-a': true,
        'folder-b': true,
        [TRASH_SECTION_ID]: true,
      },
    });

    const items = buildProjectFeedItems(sections, 2);
    expect(items[0]).toMatchObject({
      type: 'section',
      section: { id: ALL_PROJECTS_SECTION_ID },
    });
    expect(items.some((item) => item.type === 'empty' && item.section.id === 'folder-b')).toBe(true);
    expect(items.some((item) => item.type === 'section' && item.section.id === TRASH_SECTION_ID)).toBe(true);
    expect(items.some((item) => item.type === 'row' && item.section.id === ALL_PROJECTS_SECTION_ID)).toBe(true);
  });
});

