import RNFS from 'react-native-fs';

const PORTABLE_FILE_URI_PREFIX = 'aura-file://';
const PROJECT_PREVIEW_DIRNAME = 'project-previews';

type SandboxRootToken = 'documents' | 'temporary';

interface SandboxRoot {
  token: SandboxRootToken;
  path: string;
  legacyMarkers: string[];
}

interface ProjectLike {
  sourceVideoUri: string;
  previewUri: string;
}

interface ProjectStateLike<
  TProject extends ProjectLike = ProjectLike,
  TFolder = unknown,
> {
  folders: TFolder[];
  projects: TProject[];
  trashActivated: boolean;
}

function normalizePath(value: string | null | undefined): string {
  return (value ?? '').replace(/^file:\/\//, '').replace(/\/+$/, '');
}

function ensureFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/');
}

function getPathBasename(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  return parts.at(-1) ?? null;
}

function joinPath(root: string, relativePath: string): string {
  if (!relativePath) {
    return root;
  }

  return `${root}/${relativePath.replace(/^\/+/, '')}`;
}

function getRelativePath(path: string, root: string): string | null {
  if (path === root) {
    return '';
  }

  if (path.startsWith(`${root}/`)) {
    return path.slice(root.length + 1);
  }

  return null;
}

function createSandboxRoot(
  token: SandboxRootToken,
  rootPath: string | null | undefined,
): SandboxRoot | null {
  const normalizedPath = normalizePath(rootPath);
  if (!normalizedPath) {
    return null;
  }

  const basename = getPathBasename(normalizedPath);

  return {
    token,
    path: normalizedPath,
    legacyMarkers: basename ? [basename] : [],
  };
}

function getSandboxRoots(): SandboxRoot[] {
  return [
    createSandboxRoot('documents', RNFS.DocumentDirectoryPath),
    createSandboxRoot('temporary', RNFS.TemporaryDirectoryPath),
  ].filter((root): root is SandboxRoot => root !== null);
}

function serializeSandboxFileUri(uri: string): string {
  const path = normalizePath(uri);
  if (!isAbsolutePath(path)) {
    return uri;
  }

  for (const root of getSandboxRoots()) {
    const relativePath = getRelativePath(path, root.path);
    if (relativePath !== null) {
      return `${PORTABLE_FILE_URI_PREFIX}${root.token}/${relativePath}`;
    }
  }

  return uri;
}

function restorePortableSandboxFileUri(uri: string): string | undefined {
  if (!uri.startsWith(PORTABLE_FILE_URI_PREFIX)) {
    return undefined;
  }

  const rawLocation = uri.slice(PORTABLE_FILE_URI_PREFIX.length);
  const firstSlashIndex = rawLocation.indexOf('/');
  const token = (
    firstSlashIndex === -1 ? rawLocation : rawLocation.slice(0, firstSlashIndex)
  ) as SandboxRootToken;
  const relativePath =
    firstSlashIndex === -1 ? '' : rawLocation.slice(firstSlashIndex + 1);
  const root = getSandboxRoots().find(item => item.token === token);

  if (!root) {
    return uri;
  }

  return ensureFileUri(joinPath(root.path, relativePath));
}

function restoreLegacySandboxFileUri(uri: string): string {
  const path = normalizePath(uri);
  if (!isAbsolutePath(path)) {
    return uri;
  }

  const lowercasePath = path.toLowerCase();

  for (const root of getSandboxRoots()) {
    const exactRelativePath = getRelativePath(path, root.path);
    if (exactRelativePath !== null) {
      return ensureFileUri(joinPath(root.path, exactRelativePath));
    }

    for (const marker of root.legacyMarkers) {
      const markerWithSeparators = `/${marker.toLowerCase()}/`;
      const markerIndex = lowercasePath.lastIndexOf(markerWithSeparators);
      if (markerIndex >= 0) {
        const relativePath = path.slice(
          markerIndex + markerWithSeparators.length,
        );
        return ensureFileUri(joinPath(root.path, relativePath));
      }

      if (lowercasePath.endsWith(`/${marker.toLowerCase()}`)) {
        return ensureFileUri(root.path);
      }
    }
  }

  return uri;
}

export function restoreSandboxFileUri(uri: string): string {
  return restorePortableSandboxFileUri(uri) ?? restoreLegacySandboxFileUri(uri);
}

export function serializeProjectForPersistence<TProject extends ProjectLike>(
  project: TProject,
): TProject {
  return {
    ...project,
    sourceVideoUri: serializeSandboxFileUri(project.sourceVideoUri),
    previewUri: serializeSandboxFileUri(project.previewUri),
  };
}

export function restoreProjectFromPersistence<TProject extends ProjectLike>(
  project: TProject,
): TProject {
  return {
    ...project,
    sourceVideoUri: restoreSandboxFileUri(project.sourceVideoUri),
    previewUri: restoreSandboxFileUri(project.previewUri),
  };
}

export function serializeProjectStateForPersistence<
  TProject extends ProjectLike,
  TFolder,
>(
  state: ProjectStateLike<TProject, TFolder>,
): ProjectStateLike<TProject, TFolder> {
  return {
    ...state,
    projects: state.projects.map(project =>
      serializeProjectForPersistence(project),
    ),
  };
}

export function restoreProjectStateFromPersistence<
  TProject extends ProjectLike,
  TFolder,
>(
  state: Partial<ProjectStateLike<TProject, TFolder>> | undefined,
): Partial<ProjectStateLike<TProject, TFolder>> {
  if (!state) {
    return {};
  }

  return {
    ...state,
    projects: Array.isArray(state.projects)
      ? state.projects.map(project => restoreProjectFromPersistence(project))
      : [],
  };
}

export function looksLikeGeneratedProjectPreviewUri(
  uri: string | null | undefined,
): boolean {
  if (!uri) {
    return false;
  }

  if (
    uri.startsWith(
      `${PORTABLE_FILE_URI_PREFIX}documents/${PROJECT_PREVIEW_DIRNAME}/`,
    )
  ) {
    return true;
  }

  return normalizePath(uri).includes(`/${PROJECT_PREVIEW_DIRNAME}/`);
}

export async function fileUriExists(uri: string): Promise<boolean> {
  const path = normalizePath(restoreSandboxFileUri(uri));
  if (!isAbsolutePath(path)) {
    return false;
  }

  try {
    return await RNFS.exists(path);
  } catch {
    return false;
  }
}
