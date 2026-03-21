import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../app/navigation/types';
import ProjectDashboardList from '../components/home/ProjectDashboardList';
import NamePromptModal from '../components/home/NamePromptModal';
import VideoPickerModal from '../components/home/VideoPickerModal';
import BlurHeader from '../components/home/BlurHeader';
import type { VideoItem } from '../store/useLibraryStore';
import { useProjectStore } from '../store/useProjectStore';
import type { Project } from '../store/useProjectStore';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface PromptState {
  visible: boolean;
  mode: 'create-folder' | 'rename-folder' | 'rename-project';
  targetId: string | null;
  title: string;
  description: string;
  initialValue: string;
  confirmLabel: string;
}

const INITIAL_PROMPT_STATE: PromptState = {
  visible: false,
  mode: 'create-folder',
  targetId: null,
  title: '',
  description: '',
  initialValue: '',
  confirmLabel: 'Save',
};

function sanitizeName(value: string): string {
  return value.trim();
}

export default function HomeScreen({ navigation }: Props): React.JSX.Element {
  const folders = useProjectStore((state) => state.folders);
  const projects = useProjectStore((state) => state.projects);
  const trashActivated = useProjectStore((state) => state.trashActivated);
  const createProject = useProjectStore((state) => state.createProject);
  const createFolder = useProjectStore((state) => state.createFolder);
  const renameFolder = useProjectStore((state) => state.renameFolder);
  const removeFolder = useProjectStore((state) => state.removeFolder);
  const renameProject = useProjectStore((state) => state.renameProject);
  const duplicateProject = useProjectStore((state) => state.duplicateProject);
  const moveProjectToFolder = useProjectStore((state) => state.moveProjectToFolder);
  const removeProject = useProjectStore((state) => state.removeProject);
  const recoverProject = useProjectStore((state) => state.recoverProject);
  const removeProjectPermanently = useProjectStore((state) => state.removeProjectPermanently);
  const cleanTrash = useProjectStore((state) => state.cleanTrash);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [promptState, setPromptState] = useState<PromptState>(INITIAL_PROMPT_STATE);

  const projectIndex = useMemo(
    () =>
      projects.reduce<Record<string, Project>>((accumulator, project) => {
        accumulator[project.id] = project;
        return accumulator;
      }, {}),
    [projects],
  );

  const closePrompt = useCallback(() => {
    setPromptState(INITIAL_PROMPT_STATE);
  }, []);

  const handleOpenFolderPrompt = useCallback((folderId?: string) => {
    const folder = folderId ? folders.find((item) => item.id === folderId) : undefined;
    setPromptState({
      visible: true,
      mode: folder ? 'rename-folder' : 'create-folder',
      targetId: folder?.id ?? null,
      title: folder ? 'Rename Folder' : 'New Folder',
      description: folder
        ? 'Choose a clear folder name for your project group.'
        : 'Create a folder to organize projects on the home screen.',
      initialValue: folder?.name ?? 'New Folder',
      confirmLabel: folder ? 'Rename' : 'Create',
    });
  }, [folders]);

  const handleOpenProjectRenamePrompt = useCallback((project: Project) => {
    setPromptState({
      visible: true,
      mode: 'rename-project',
      targetId: project.id,
      title: 'Rename Project',
      description: 'Update the project name shown on the home screen.',
      initialValue: project.name,
      confirmLabel: 'Rename',
    });
  }, []);

  const handleConfirmPrompt = useCallback(
    (rawValue: string) => {
      const nextName = sanitizeName(rawValue);
      if (!nextName) {
        Alert.alert('Name Required', 'Please enter a non-empty name.');
        return;
      }

      if (promptState.mode === 'create-folder') {
        createFolder(nextName);
      } else if (promptState.mode === 'rename-folder' && promptState.targetId) {
        renameFolder(promptState.targetId, nextName);
      } else if (promptState.mode === 'rename-project' && promptState.targetId) {
        renameProject(promptState.targetId, nextName);
      }

      closePrompt();
    },
    [
      closePrompt,
      createFolder,
      promptState.mode,
      promptState.targetId,
      renameFolder,
      renameProject,
    ],
  );

  const handleCreateAction = useCallback((actionId: 'new-project' | 'new-folder') => {
    if (actionId === 'new-folder') {
      handleOpenFolderPrompt();
      return;
    }

    setPickerVisible(true);
  }, [handleOpenFolderPrompt]);

  const handleSelectVideo = useCallback(
    (video: VideoItem) => {
      const project = createProject({
        sourceVideoUri: video.uri,
        duration: video.duration,
        filename: video.filename,
      });

      setPickerVisible(false);
      navigation.navigate('Editor', { projectId: project.id });
    },
    [createProject, navigation],
  );

  const handleProjectPress = useCallback(
    (projectId: string) => {
      const project = projectIndex[projectId];
      if (!project || project.status === 'trash') {
        return;
      }

      navigation.navigate('Editor', { projectId });
    },
    [navigation, projectIndex],
  );

  const handleProjectAction = useCallback(
    (project: Project, action: 'rename' | 'duplicate' | 'remove' | 'recover' | 'remove-permanently' | { type: 'move'; folderId: string }) => {
      if (typeof action === 'object' && action.type === 'move') {
        moveProjectToFolder(project.id, action.folderId);
        return;
      }

      switch (action) {
        case 'rename':
          handleOpenProjectRenamePrompt(project);
          break;
        case 'duplicate':
          duplicateProject(project.id);
          break;
        case 'remove':
          removeProject(project.id);
          break;
        case 'recover':
          recoverProject(project.id);
          break;
        case 'remove-permanently':
          Alert.alert(
            'Remove Permanently',
            `Delete "${project.name}" forever?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => removeProjectPermanently(project.id),
              },
            ],
          );
          break;
      }
    },
    [
      duplicateProject,
      handleOpenProjectRenamePrompt,
      moveProjectToFolder,
      recoverProject,
      removeProject,
      removeProjectPermanently,
    ],
  );

  const handleFolderAction = useCallback(
    (
      section: {
        id: string;
        title: string;
        kind: 'all' | 'folder' | 'trash';
      },
      action: 'rename' | 'remove' | 'clean-trash',
    ) => {
      if (action === 'rename') {
        handleOpenFolderPrompt(section.id);
        return;
      }

      if (action === 'remove') {
        removeFolder(section.id);
        return;
      }

      Alert.alert(
        'Clean Trash',
        'Remove every project in Trash permanently?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clean Trash',
            style: 'destructive',
            onPress: () => cleanTrash(),
          },
        ],
      );
    },
    [cleanTrash, handleOpenFolderPrompt, removeFolder],
  );

  return (
    <View style={styles.root}>
      <ProjectDashboardList
        folders={folders}
        projects={projects}
        trashActivated={trashActivated}
        onProjectPress={handleProjectPress}
        onCreateAction={handleCreateAction}
        onProjectAction={handleProjectAction}
        onFolderAction={handleFolderAction}
      />
      <BlurHeader />

      {projects.length === 0 && folders.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyTitle}>Start Your First Project</Text>
          <Text style={styles.emptyBody}>
            Tap the + button to create a project from a video or make a folder first.
          </Text>
        </View>
      ) : null}

      <VideoPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelectVideo={handleSelectVideo}
      />

      <NamePromptModal
        visible={promptState.visible}
        title={promptState.title}
        description={promptState.description}
        initialValue={promptState.initialValue}
        confirmLabel={promptState.confirmLabel}
        onCancel={closePrompt}
        onConfirm={handleConfirmPrompt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyOverlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 132,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: 'rgba(20,20,20,0.74)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
