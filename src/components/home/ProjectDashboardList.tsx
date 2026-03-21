import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Text,
  type ViewProps,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  Plus,
} from 'lucide-react-native';
import { MenuView } from '@react-native-menu/menu';
import { GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { HEADER_CONTENT_HEIGHT } from './BlurHeader';
import ProjectCard from './ProjectCard';
import {
  ALL_PROJECTS_SECTION_ID,
  buildProjectFeedItems,
  buildProjectSections,
  TRASH_SECTION_ID,
  type ProjectSection,
} from './projectFeedModel';
import type { ColumnCount } from '../../hooks/usePinchToResize';
import { usePinchToResize } from '../../hooks/usePinchToResize';
import { useHaptics } from '../../hooks/useHaptics';
import type { Folder, Project } from '../../store/useProjectStore';
import AnimatedPressable from '../shared/AnimatedPressable';
import {
  spacing,
  typography,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from '../../theme';

type FolderAction = 'rename' | 'remove' | 'clean-trash';
type ProjectAction =
  | 'rename'
  | 'duplicate'
  | 'remove'
  | 'recover'
  | 'remove-permanently'
  | { type: 'move'; folderId: string };

interface ProjectDashboardListProps {
  folders: Folder[];
  projects: Project[];
  trashActivated: boolean;
  onProjectPress: (projectId: string) => void;
  onCreateAction: (actionId: 'new-project' | 'new-folder') => void;
  onProjectAction: (project: Project, action: ProjectAction) => void;
  onFolderAction: (section: ProjectSection, action: FolderAction) => void;
}

const LONG_PRESS_INTENT_THRESHOLD_MS = 400;

type InteractiveMenuViewProps = React.ComponentProps<typeof MenuView> &
  Pick<ViewProps, 'onTouchStart' | 'onTouchEnd' | 'onTouchCancel'>;

const InteractiveMenuView =
  MenuView as unknown as React.ComponentType<InteractiveMenuViewProps>;

function icon(name: {
  ios: string;
  android: string;
}): string {
  return Platform.select({
    ios: name.ios,
    android: name.android,
    default: name.ios,
  }) as string;
}

export default function ProjectDashboardList({
  folders,
  projects,
  trashActivated,
  onProjectPress,
  onCreateAction,
  onProjectAction,
  onFolderAction,
}: ProjectDashboardListProps): React.JSX.Element {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const colors = theme.colors;
  const menuThemeVariant = theme.isDark ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const { columns, pinchGesture } = usePinchToResize({ defaultColumns: 2 });
  const haptics = useHaptics();

  const [columnCount, setColumnCount] = useState<ColumnCount>(
    columns.value as ColumnCount,
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    [ALL_PROJECTS_SECTION_ID]: true,
  });
  const touchStartedAtRef = useRef(0);

  const handleColumnChange = useCallback(
    (next: ColumnCount) => {
      setColumnCount(next);
      haptics.light();
    },
    [haptics],
  );

  useAnimatedReaction(
    () => columns.value,
    (next, prev) => {
      if (next !== prev) {
        runOnJS(handleColumnChange)(next);
      }
    },
    [handleColumnChange],
  );

  const sections = useMemo(
    () =>
      buildProjectSections({
        folders,
        projects,
        trashActivated,
        expandedSections,
      }),
    [expandedSections, folders, projects, trashActivated],
  );

  const items = useMemo(
    () => buildProjectFeedItems(sections, columnCount),
    [columnCount, sections],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !(current[sectionId] ?? sectionId === ALL_PROJECTS_SECTION_ID),
    }));
  }, []);

  const handleMenuTouchStart = useCallback(() => {
    touchStartedAtRef.current = Date.now();
  }, []);

  const handleMenuTouchCancel = useCallback(() => {
    touchStartedAtRef.current = 0;
  }, []);

  const createMenuTapHandler = useCallback(
    (onTap: () => void) => () => {
      const touchStartedAt = touchStartedAtRef.current;
      touchStartedAtRef.current = 0;

      if (!touchStartedAt) {
        return;
      }

      const pressDuration = Date.now() - touchStartedAt;
      if (pressDuration >= LONG_PRESS_INTENT_THRESHOLD_MS) {
        return;
      }

      onTap();
    },
    [],
  );

  const regularFolderActions = useMemo(
    () =>
      folders.map((folder) => ({
        id: `move:${folder.id}`,
        title: folder.name,
        image: icon({ ios: 'folder', android: 'ic_menu_agenda' }),
      })),
    [folders],
  );

  const renderSectionHeader = useCallback(
    (section: ProjectSection): React.JSX.Element => {
      const countLabel = `${section.projects.length}`;
      const chevronRotation = section.expanded ? '180deg' : '0deg';
      const isTrash = section.id === TRASH_SECTION_ID;
      const isAllProjects = section.id === ALL_PROJECTS_SECTION_ID;

      const content = (
        <View style={styles.sectionHeaderButton}>
          <View style={styles.sectionHeaderLeft}>
            {section.kind === 'folder' ? (
              section.expanded ? (
                <FolderOpen size={18} color={colors.textSecondary} />
              ) : (
                <FolderIcon size={18} color={colors.textSecondary} />
              )
            ) : null}
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{countLabel}</Text>
            </View>
          </View>
          <ChevronDown
            size={18}
            color={colors.textSecondary}
            style={{ transform: [{ rotate: chevronRotation }] }}
          />
        </View>
      );

      if (isAllProjects) {
        return (
          <AnimatedPressable
            onPress={() => toggleSection(section.id)}
            style={styles.sectionHeaderPressable}
            pressedScale={0.995}
          >
            {content}
          </AnimatedPressable>
        );
      }

      const actions = isTrash
        ? [
            {
              id: 'clean-trash',
              title: 'Clean Trash',
              image: icon({ ios: 'trash', android: 'ic_menu_delete' }),
              attributes: {
                destructive: true,
              },
            },
          ]
        : [
            {
              id: 'rename',
              title: 'Rename',
              image: icon({ ios: 'pencil', android: 'ic_menu_edit' }),
            },
            {
              id: 'remove',
              title: 'Remove',
              image: icon({ ios: 'trash', android: 'ic_menu_delete' }),
              attributes: {
                destructive: true,
              },
            },
          ];

      return (
        <InteractiveMenuView
          title={section.title}
          shouldOpenOnLongPress
          themeVariant={menuThemeVariant}
          actions={actions}
          onTouchStart={handleMenuTouchStart}
          onTouchEnd={createMenuTapHandler(() => toggleSection(section.id))}
          onTouchCancel={handleMenuTouchCancel}
          onPressAction={({ nativeEvent }) => {
            const actionId = nativeEvent.event as FolderAction;
            if (actionId === 'clean-trash' && section.projects.length === 0) {
              Alert.alert('Trash is already empty.');
              return;
            }

            onFolderAction(section, actionId);
          }}
        >
          {content}
        </InteractiveMenuView>
      );
    },
    [
      colors.textSecondary,
      createMenuTapHandler,
      handleMenuTouchCancel,
      handleMenuTouchStart,
      menuThemeVariant,
      onFolderAction,
      styles.countPill,
      styles.countText,
      styles.sectionHeaderButton,
      styles.sectionHeaderLeft,
      styles.sectionHeaderPressable,
      styles.sectionTitle,
      toggleSection,
    ],
  );

  const renderRow = useCallback(
    (section: ProjectSection, rowProjects: Project[]): React.JSX.Element => (
      <View style={styles.projectRow}>
        {rowProjects.map((project) => {
          const isTrash = project.status === 'trash';
          const moveTargets = regularFolderActions.filter(
            (folderAction) => folderAction.id !== `move:${project.folderId}`,
          );

          const actions = isTrash
            ? [
                {
                  id: 'recover',
                  title: 'Recover',
                  image: icon({ ios: 'arrow.uturn.backward', android: 'ic_menu_revert' }),
                },
                {
                  id: 'remove-permanently',
                  title: 'Remove Permanently',
                  image: icon({ ios: 'trash', android: 'ic_menu_delete' }),
                  attributes: {
                    destructive: true,
                  },
                },
              ]
            : [
                {
                  id: 'rename',
                  title: 'Rename',
                  image: icon({ ios: 'pencil', android: 'ic_menu_edit' }),
                },
                {
                  id: 'duplicate',
                  title: 'Duplicate',
                  image: icon({ ios: 'plus.square.on.square', android: 'ic_menu_add' }),
                },
                {
                  id: 'move',
                  title: 'Move to Folder',
                  image: icon({ ios: 'folder', android: 'ic_menu_agenda' }),
                  attributes: {
                    disabled: moveTargets.length === 0,
                  },
                  subactions: moveTargets,
                },
                {
                  id: 'remove',
                  title: 'Remove',
                  image: icon({ ios: 'trash', android: 'ic_menu_delete' }),
                  attributes: {
                    destructive: true,
                  },
                },
              ];

          return (
            <InteractiveMenuView
              key={`${section.id}:${project.id}`}
              title={project.name}
              shouldOpenOnLongPress
              themeVariant={menuThemeVariant}
              actions={actions}
              onTouchStart={handleMenuTouchStart}
              onTouchEnd={createMenuTapHandler(() => onProjectPress(project.id))}
              onTouchCancel={handleMenuTouchCancel}
              onPressAction={({ nativeEvent }) => {
                const actionId = nativeEvent.event;
                if (actionId.startsWith('move:')) {
                  onProjectAction(project, {
                    type: 'move',
                    folderId: actionId.replace('move:', ''),
                  });
                  return;
                }

                onProjectAction(project, actionId as ProjectAction);
              }}
            >
              <ProjectCard
                previewUri={project.previewUri}
                name={project.name}
                duration={project.duration}
                columns={columnCount}
              />
            </InteractiveMenuView>
          );
        })}
      </View>
    ),
    [
      columnCount,
      createMenuTapHandler,
      handleMenuTouchCancel,
      handleMenuTouchStart,
      menuThemeVariant,
      onProjectAction,
      onProjectPress,
      regularFolderActions,
      styles.projectRow,
    ],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator],
  );

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pinchGesture}>
        <FlatList
          key={`projects-${columnCount}`}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: insets.top + HEADER_CONTENT_HEIGHT + spacing.sm,
              paddingBottom: insets.bottom + 120,
            },
          ]}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return renderSectionHeader(item.section);
            }

            if (item.type === 'empty') {
              return (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {item.section.kind === 'trash'
                      ? 'Trash is empty.'
                      : 'No projects here yet.'}
                  </Text>
                </View>
              );
            }

            return renderRow(item.section, item.projects);
          }}
          ItemSeparatorComponent={renderSeparator}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={30}
          windowSize={7}
          initialNumToRender={10}
        />
      </GestureDetector>

      <View style={[styles.fabWrapper, { right: spacing.lg, bottom: insets.bottom + spacing.lg }]}>
        <MenuView
          title="Create"
          themeVariant={menuThemeVariant}
          shouldOpenOnLongPress={false}
          actions={[
            {
              id: 'new-project',
              title: 'New Project',
              image: icon({ ios: 'plus.rectangle.on.folder', android: 'ic_menu_add' }),
            },
            {
              id: 'new-folder',
              title: 'New Folder',
              image: icon({ ios: 'folder.badge.plus', android: 'ic_menu_agenda' }),
            },
          ]}
          onPressAction={({ nativeEvent }) =>
            onCreateAction(nativeEvent.event as 'new-project' | 'new-folder')
          }
        >
          <View style={styles.fab}>
            <Plus size={22} color={colors.accentForeground} />
          </View>
        </MenuView>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const colors = theme.colors;

  return {
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingHorizontal: 0,
    },
    separator: {
      height: spacing.xs,
    },
    sectionHeaderButton: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.background,
    },
    sectionHeaderPressable: {
      backgroundColor: colors.background,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    countPill: {
      minWidth: 26,
      height: 22,
      paddingHorizontal: spacing.xs + 2,
      borderRadius: 11,
      backgroundColor: colors.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countText: {
      ...typography.captionMedium,
      color: colors.textSecondary,
    },
    projectRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    emptyState: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    emptyStateText: {
      ...typography.body,
      color: colors.textTertiary,
      paddingVertical: spacing.sm,
    },
    fabWrapper: {
      position: 'absolute',
    },
    fab: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      shadowColor: colors.black,
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  };
};
