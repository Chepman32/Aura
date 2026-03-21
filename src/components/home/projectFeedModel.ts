import type { Folder, Project } from '../../store/useProjectStore';

export const ALL_PROJECTS_SECTION_ID = 'all-projects';
export const TRASH_SECTION_ID = 'trash-projects';

export type ProjectSectionKind = 'all' | 'folder' | 'trash';

export interface ProjectSection {
  id: string;
  title: string;
  kind: ProjectSectionKind;
  folderId: string | null;
  projects: Project[];
  expanded: boolean;
}

export type ProjectFeedItem =
  | {
      id: string;
      type: 'section';
      section: ProjectSection;
    }
  | {
      id: string;
      type: 'row';
      section: ProjectSection;
      projects: Project[];
      rowIndex: number;
    }
  | {
      id: string;
      type: 'empty';
      section: ProjectSection;
    };

interface BuildProjectSectionsParams {
  folders: Folder[];
  projects: Project[];
  trashActivated: boolean;
  expandedSections: Record<string, boolean>;
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((left, right) => right.updatedAt - left.updatedAt);
}

function isExpanded(
  sectionId: string,
  kind: ProjectSectionKind,
  expandedSections: Record<string, boolean>,
): boolean {
  if (expandedSections[sectionId] !== undefined) {
    return expandedSections[sectionId];
  }

  return kind === 'all';
}

export function buildProjectSections({
  folders,
  projects,
  trashActivated,
  expandedSections,
}: BuildProjectSectionsParams): ProjectSection[] {
  const activeProjects = sortProjects(
    projects.filter((project) => project.status === 'active'),
  );
  const trashProjects = sortProjects(
    projects.filter((project) => project.status === 'trash'),
  );

  const sections: ProjectSection[] = [
    {
      id: ALL_PROJECTS_SECTION_ID,
      title: 'All Projects',
      kind: 'all',
      folderId: null,
      projects: activeProjects,
      expanded: isExpanded(ALL_PROJECTS_SECTION_ID, 'all', expandedSections),
    },
  ];

  const orderedFolders = [...folders].sort(
    (left, right) => left.createdAt - right.createdAt,
  );

  orderedFolders.forEach((folder) => {
    sections.push({
      id: folder.id,
      title: folder.name,
      kind: 'folder',
      folderId: folder.id,
      projects: activeProjects.filter((project) => project.folderId === folder.id),
      expanded: isExpanded(folder.id, 'folder', expandedSections),
    });
  });

  if (trashActivated || trashProjects.length > 0) {
    sections.push({
      id: TRASH_SECTION_ID,
      title: 'Trash',
      kind: 'trash',
      folderId: null,
      projects: trashProjects,
      expanded: isExpanded(TRASH_SECTION_ID, 'trash', expandedSections),
    });
  }

  return sections;
}

export function buildProjectFeedItems(
  sections: ProjectSection[],
  columnCount: number,
): ProjectFeedItem[] {
  const items: ProjectFeedItem[] = [];

  sections.forEach((section) => {
    items.push({
      id: `section:${section.id}`,
      type: 'section',
      section,
    });

    if (!section.expanded) {
      return;
    }

    if (section.projects.length === 0) {
      items.push({
        id: `empty:${section.id}`,
        type: 'empty',
        section,
      });
      return;
    }

    for (let index = 0; index < section.projects.length; index += columnCount) {
      items.push({
        id: `row:${section.id}:${index}`,
        type: 'row',
        section,
        projects: section.projects.slice(index, index + columnCount),
        rowIndex: index / columnCount,
      });
    }
  });

  return items;
}

