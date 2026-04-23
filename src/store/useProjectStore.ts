import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  generateProjectPreview,
  cleanupProjectPreview,
} from '../services/projectPreview';
import { createFileStorage } from './fileStorage';
import {
  fileUriExists,
  looksLikeGeneratedProjectPreviewUri,
  restoreProjectStateFromPersistence,
  serializeProjectStateForPersistence,
} from './projectPersistence';

export type ProjectStatus = 'active' | 'trash';

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  sourceVideoUri: string;
  duration: number;
  folderId: string | null;
  previousFolderId: string | null;
  status: ProjectStatus;
  previewUri: string;
  previewTimeMs: number;
  filterId: string;
  filterIntensity: number;
  createdAt: number;
  updatedAt: number;
}

interface ProjectState {
  folders: Folder[];
  projects: Project[];
  trashActivated: boolean;
}

interface CreateProjectInput {
  sourceVideoUri: string;
  duration: number;
  filename: string;
  folderId?: string | null;
}

interface ProjectSessionUpdate {
  filterId?: string;
  filterIntensity?: number;
  previewTimeMs?: number;
}

interface ProjectPreviewUpdate {
  previewUri: string;
  previewTimeMs?: number;
}

interface RefreshProjectPreviewOptions {
  sourceVideoUri?: string;
  filterId?: string;
  filterIntensity?: number;
  timeMs?: number;
}

interface ProjectActions {
  createProject: (input: CreateProjectInput) => Project;
  renameProject: (projectId: string, nextName: string) => void;
  duplicateProject: (projectId: string) => Project | null;
  moveProjectToFolder: (projectId: string, folderId: string) => void;
  removeProject: (projectId: string) => void;
  recoverProject: (projectId: string) => void;
  removeProjectPermanently: (projectId: string) => void;
  updateProjectSession: (
    projectId: string,
    update: ProjectSessionUpdate,
  ) => void;
  updateProjectPreview: (
    projectId: string,
    update: ProjectPreviewUpdate,
  ) => void;
  refreshProjectPreview: (
    projectId: string,
    options?: RefreshProjectPreviewOptions,
  ) => Promise<void>;
  createFolder: (name?: string) => Folder;
  renameFolder: (folderId: string, nextName: string) => void;
  removeFolder: (folderId: string) => void;
  cleanTrash: () => void;
  reset: () => void;
}

const INITIAL_STATE: ProjectState = {
  folders: [],
  projects: [],
  trashActivated: false,
};
const PROJECT_STORE_VERSION = 1;

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function trimName(name: string): string {
  return name.trim();
}

function normalizeProjectName(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) {
    return 'Untitled Project';
  }

  const withoutExtension = trimmed.replace(/\.[^.]+$/, '');
  return withoutExtension.trim() || 'Untitled Project';
}

function makeCopyName(name: string): string {
  const trimmed = trimName(name);
  return trimmed.endsWith('Copy') ? `${trimmed} 2` : `${trimmed} Copy`;
}

function clampPreviewTime(timeMs: number): number {
  return Number.isFinite(timeMs) ? Math.max(0, Math.round(timeMs)) : 0;
}

interface ProjectPreviewRepair {
  id: string;
  sourceVideoUri: string;
  filterId: string;
  filterIntensity: number;
  previewTimeMs: number;
  previewUri: string;
}

async function repairHydratedProjectPreviews(
  state: ProjectState & ProjectActions,
): Promise<void> {
  if (!state.projects.length) {
    return;
  }

  const repairs = (
    await Promise.all(
      state.projects.map(
        async (project): Promise<ProjectPreviewRepair | null> => {
          if (!looksLikeGeneratedProjectPreviewUri(project.previewUri)) {
            return null;
          }

          if (await fileUriExists(project.previewUri)) {
            return null;
          }

          const previewUri = await generateProjectPreview({
            projectId: project.id,
            sourceVideoUri: project.sourceVideoUri,
            filterId: project.filterId,
            filterIntensity: project.filterIntensity,
            timeMs: clampPreviewTime(project.previewTimeMs),
          });

          if (previewUri === project.previewUri) {
            return null;
          }

          return {
            id: project.id,
            sourceVideoUri: project.sourceVideoUri,
            filterId: project.filterId,
            filterIntensity: project.filterIntensity,
            previewTimeMs: project.previewTimeMs,
            previewUri,
          };
        },
      ),
    )
  ).filter((repair): repair is ProjectPreviewRepair => repair !== null);

  if (!repairs.length) {
    return;
  }

  repairs.forEach(repair => {
    const currentProject = useProjectStore
      .getState()
      .projects.find(project => project.id === repair.id);

    const snapshotMatches =
      currentProject?.sourceVideoUri === repair.sourceVideoUri &&
      currentProject?.filterId === repair.filterId &&
      currentProject?.filterIntensity === repair.filterIntensity &&
      currentProject?.previewTimeMs === repair.previewTimeMs;

    if (!currentProject || !snapshotMatches) {
      return;
    }

    if (currentProject.previewUri === repair.previewUri) {
      return;
    }

    useProjectStore.getState().updateProjectPreview(repair.id, {
      previewUri: repair.previewUri,
      previewTimeMs: repair.previewTimeMs,
    });
  });
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      createProject: ({
        sourceVideoUri,
        duration,
        filename,
        folderId = null,
      }) => {
        const timestamp = Date.now();
        const project: Project = {
          id: createId('project'),
          name: normalizeProjectName(filename),
          sourceVideoUri,
          duration,
          folderId,
          previousFolderId: folderId,
          status: 'active',
          previewUri: sourceVideoUri,
          previewTimeMs: 0,
          filterId: 'original',
          filterIntensity: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set(state => ({
          projects: [project, ...state.projects],
        }));

        get()
          .refreshProjectPreview(project.id, { timeMs: 0 })
          .catch(() => {});
        return project;
      },

      renameProject: (projectId, nextName) => {
        const trimmedName = trimName(nextName);
        if (!trimmedName) {
          return;
        }

        set(state => ({
          projects: state.projects.map(project =>
            project.id === projectId
              ? { ...project, name: trimmedName, updatedAt: Date.now() }
              : project,
          ),
        }));
      },

      duplicateProject: projectId => {
        const project = get().projects.find(item => item.id === projectId);
        if (!project || project.status !== 'active') {
          return null;
        }

        const timestamp = Date.now();
        const duplicate: Project = {
          ...project,
          id: createId('project'),
          name: makeCopyName(project.name),
          previewUri: project.previewUri || project.sourceVideoUri,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        set(state => ({
          projects: [duplicate, ...state.projects],
        }));

        get()
          .refreshProjectPreview(duplicate.id, {
            timeMs: duplicate.previewTimeMs,
            sourceVideoUri: duplicate.sourceVideoUri,
            filterId: duplicate.filterId,
            filterIntensity: duplicate.filterIntensity,
          })
          .catch(() => {});
        return duplicate;
      },

      moveProjectToFolder: (projectId, folderId) => {
        set(state => ({
          projects: state.projects.map(project => {
            if (project.id !== projectId || project.status !== 'active') {
              return project;
            }

            return {
              ...project,
              folderId,
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      removeProject: projectId => {
        set(state => ({
          trashActivated: true,
          projects: state.projects.map(project => {
            if (project.id !== projectId || project.status === 'trash') {
              return project;
            }

            return {
              ...project,
              previousFolderId: project.folderId,
              folderId: null,
              status: 'trash',
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      recoverProject: projectId => {
        set(state => ({
          projects: state.projects.map(project => {
            if (project.id !== projectId || project.status !== 'trash') {
              return project;
            }

            const folderExists =
              !!project.previousFolderId &&
              state.folders.some(
                folder => folder.id === project.previousFolderId,
              );

            return {
              ...project,
              status: 'active',
              folderId: folderExists ? project.previousFolderId : null,
              previousFolderId: folderExists ? project.previousFolderId : null,
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      removeProjectPermanently: projectId => {
        const project = get().projects.find(item => item.id === projectId);
        set(state => ({
          projects: state.projects.filter(item => item.id !== projectId),
        }));

        cleanupProjectPreview(project?.previewUri).catch(() => {});
      },

      updateProjectSession: (projectId, update) => {
        set(state => ({
          projects: state.projects.map(project => {
            if (project.id !== projectId) {
              return project;
            }

            return {
              ...project,
              filterId: update.filterId ?? project.filterId,
              filterIntensity:
                update.filterIntensity ?? project.filterIntensity,
              previewTimeMs:
                update.previewTimeMs === undefined
                  ? project.previewTimeMs
                  : clampPreviewTime(update.previewTimeMs),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      updateProjectPreview: (projectId, update) => {
        const currentProject = get().projects.find(
          item => item.id === projectId,
        );
        set(state => ({
          projects: state.projects.map(project => {
            if (project.id !== projectId) {
              return project;
            }

            return {
              ...project,
              previewUri: update.previewUri,
              previewTimeMs:
                update.previewTimeMs === undefined
                  ? project.previewTimeMs
                  : clampPreviewTime(update.previewTimeMs),
              updatedAt: Date.now(),
            };
          }),
        }));

        if (
          currentProject?.previewUri &&
          currentProject.previewUri !== update.previewUri
        ) {
          cleanupProjectPreview(currentProject.previewUri).catch(() => {});
        }
      },

      refreshProjectPreview: async (projectId, options) => {
        const project = get().projects.find(item => item.id === projectId);
        if (!project) {
          return;
        }

        const timeMs = clampPreviewTime(
          options?.timeMs === undefined
            ? project.previewTimeMs
            : options.timeMs,
        );
        const sourceVideoUri =
          options?.sourceVideoUri ?? project.sourceVideoUri;
        const filterId = options?.filterId ?? project.filterId;
        const filterIntensity =
          options?.filterIntensity ?? project.filterIntensity;

        const previewUri = await generateProjectPreview({
          projectId: project.id,
          sourceVideoUri,
          filterId,
          filterIntensity,
          timeMs,
        });

        get().updateProjectPreview(projectId, {
          previewUri,
          previewTimeMs: timeMs,
        });
      },

      createFolder: (name = 'New Folder') => {
        const trimmedName = trimName(name) || 'New Folder';
        const folder: Folder = {
          id: createId('folder'),
          name: trimmedName,
          createdAt: Date.now(),
        };

        set(state => ({
          folders: [...state.folders, folder],
        }));

        return folder;
      },

      renameFolder: (folderId, nextName) => {
        const trimmedName = trimName(nextName);
        if (!trimmedName) {
          return;
        }

        set(state => ({
          folders: state.folders.map(folder =>
            folder.id === folderId ? { ...folder, name: trimmedName } : folder,
          ),
        }));
      },

      removeFolder: folderId => {
        set(state => ({
          folders: state.folders.filter(folder => folder.id !== folderId),
          projects: state.projects.map(project => ({
            ...project,
            folderId: project.folderId === folderId ? null : project.folderId,
            previousFolderId:
              project.previousFolderId === folderId
                ? null
                : project.previousFolderId,
          })),
        }));
      },

      cleanTrash: () => {
        const trashedProjects = get().projects.filter(
          project => project.status === 'trash',
        );

        set(state => ({
          projects: state.projects.filter(
            project => project.status !== 'trash',
          ),
        }));

        trashedProjects.forEach(project => {
          cleanupProjectPreview(project.previewUri).catch(() => {});
        });
      },

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'aura-projects',
      version: PROJECT_STORE_VERSION,
      storage: createJSONStorage(() => createFileStorage()),
      partialize: state =>
        serializeProjectStateForPersistence({
          folders: state.folders,
          projects: state.projects,
          trashActivated: state.trashActivated,
        }),
      migrate: persistedState =>
        restoreProjectStateFromPersistence(
          persistedState as Partial<ProjectState> | undefined,
        ),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...restoreProjectStateFromPersistence(
          persistedState as Partial<ProjectState> | undefined,
        ),
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error || !_state) {
          return;
        }

        void repairHydratedProjectPreviews(_state);
      },
    },
  ),
);
