import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ChevronDown,
  CircleUserRound,
  Home,
  Microscope,
  Search,
} from 'lucide-react-native';

type ToneScale = {
  label: string;
  keyColor: string;
  description: string;
  steps: Array<{ token: string; value: string }>;
};

const surface = '#F4F6F8';
const paper = '#FCFDFE';
const ink = '#122043';
const mutedInk = '#5E6C89';
const line = '#D9E0EA';
const deepPanel = '#10245E';

const palette: ToneScale[] = [
  {
    label: 'Primary',
    keyColor: '#1A3281',
    description: 'Deep clinical blue for authority, structure, and high-trust emphasis.',
    steps: [
      { token: '950', value: '#08122F' },
      { token: '900', value: '#0D1E4E' },
      { token: '800', value: '#1A3281' },
      { token: '700', value: '#2648A9' },
      { token: '500', value: '#5677C5' },
      { token: '300', value: '#A6B8E4' },
      { token: '100', value: '#E7EEFA' },
    ],
  },
  {
    label: 'Secondary',
    keyColor: '#2F6BFF',
    description: 'Action blue for interactive states, controls, and selected views.',
    steps: [
      { token: '950', value: '#0A266C' },
      { token: '900', value: '#13399B' },
      { token: '800', value: '#1F52D0' },
      { token: '700', value: '#2F6BFF' },
      { token: '500', value: '#6E96FF' },
      { token: '300', value: '#B5CBFF' },
      { token: '100', value: '#EAF1FF' },
    ],
  },
  {
    label: 'Tertiary',
    keyColor: '#5EA6FF',
    description: 'Soft analytical blue for supportive surfaces and informative highlights.',
    steps: [
      { token: '950', value: '#10396B' },
      { token: '900', value: '#21568F' },
      { token: '800', value: '#3B7FCF' },
      { token: '700', value: '#5EA6FF' },
      { token: '500', value: '#8BBFFF' },
      { token: '300', value: '#C3DEFF' },
      { token: '100', value: '#EEF6FF' },
    ],
  },
  {
    label: 'Neutral',
    keyColor: '#F4F6F8',
    description: 'Calm neutral infrastructure for spacious editorial layouts and forms.',
    steps: [
      { token: '950', value: '#1E2430' },
      { token: '800', value: '#556072' },
      { token: '700', value: '#7A869A' },
      { token: '500', value: '#A8B0BD' },
      { token: '300', value: '#D9E0EA' },
      { token: '200', value: '#EEF2F6' },
      { token: '100', value: '#F8FAFC' },
    ],
  },
];

const serifFamily = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

const sansFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function PaletteCard({ scale }: { scale: ToneScale }): React.JSX.Element {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <View>
          <Text style={styles.panelTitle}>{scale.label}</Text>
          <Text style={styles.panelCaption}>{scale.description}</Text>
        </View>
        <View style={[styles.keyChip, { backgroundColor: scale.keyColor }]}>
          <Text style={styles.keyChipText}>{scale.keyColor}</Text>
        </View>
      </View>

      <View style={styles.swatchRow}>
        {scale.steps.map((step) => (
          <View key={`${scale.label}-${step.token}`} style={styles.swatchColumn}>
            <View style={[styles.swatch, { backgroundColor: step.value }]} />
            <Text style={styles.swatchToken}>{step.token}</Text>
            <Text style={styles.swatchValue}>{step.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ButtonSample({
  label,
  state,
  variant,
  dark = false,
}: {
  label: string;
  state: string;
  variant: 'primary' | 'secondary' | 'ghost';
  dark?: boolean;
}): React.JSX.Element {
  const variantStyle =
    variant === 'primary'
      ? dark
        ? styles.buttonPrimaryOnDark
        : styles.buttonPrimary
      : variant === 'secondary'
        ? styles.buttonSecondary
        : dark
          ? styles.buttonGhostOnDark
          : styles.buttonGhost;

  const labelStyle =
    variant === 'primary'
      ? styles.buttonPrimaryLabel
      : dark
        ? styles.buttonGhostOnDarkLabel
        : styles.buttonSecondaryLabel;

  const stateStyle =
    state === 'Hover'
      ? styles.buttonHoverState
      : state === 'Active'
        ? styles.buttonActiveState
        : null;

  return (
    <View style={styles.buttonSample}>
      <Text style={styles.sampleLabel}>{label}</Text>
      <Pressable style={[styles.buttonBase, variantStyle, stateStyle]}>
        <Text style={labelStyle}>{state}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  placeholder,
  rightIcon,
}: {
  label: string;
  placeholder: string;
  rightIcon?: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldControl}>
        <TextInput
          editable={false}
          placeholder={placeholder}
          placeholderTextColor="#8792A7"
          style={styles.fieldInput}
        />
        {rightIcon ? <View style={styles.fieldIcon}>{rightIcon}</View> : null}
      </View>
    </View>
  );
}

function MetricCard({
  title,
  description,
  stat,
}: {
  title: string;
  description: string;
  stat: string;
}): React.JSX.Element {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricAccent} />
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricDescription}>{description}</Text>
      <Text style={styles.metricStat}>{stat}</Text>
    </View>
  );
}

export default function DesignCodeScreen(): React.JSX.Element {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.shell}>
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandLockup}>
              <View style={styles.logoMark}>
                <Microscope color="#F8FBFF" size={18} strokeWidth={1.8} />
              </View>
              <View>
                <Text style={styles.brandName}>Aurelia Clinical</Text>
                <Text style={styles.brandMeta}>Design code system for a premium medical web product</Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Edition 01</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Precision Clinical Curator</Text>
          <Text style={styles.heroBody}>
            A restrained interface language for clinical research, data review, and editorial governance.
            The system relies on deep blues, quiet neutrals, and exact hierarchy rather than ornament.
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaLabel}>Tone</Text>
              <Text style={styles.heroMetaValue}>Strict, intellectual, premium</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaLabel}>Usage</Text>
              <Text style={styles.heroMetaValue}>Clinical portals, research dashboards, archives</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaLabel}>Principle</Text>
              <Text style={styles.heroMetaValue}>Editorial clarity over decoration</Text>
            </View>
          </View>
        </View>

        <SectionHeader
          eyebrow="Color"
          title="System palette with calibrated blue authority"
          body="Primary carries trust and depth. Secondary drives action. Tertiary softens analytical surfaces. Neutral preserves the editorial calm."
        />

        <View style={styles.paletteGrid}>
          {palette.map((scale) => (
            <PaletteCard key={scale.label} scale={scale} />
          ))}
        </View>

        <SectionHeader
          eyebrow="Typography"
          title="High-contrast headline paired with disciplined sans-serif support"
          body="The headline voice feels academic and institutional. Body and label copy remain crisp, neutral, and legible across dense clinical interfaces."
        />

        <View style={styles.threeColumnGrid}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Headline</Text>
            <Text style={styles.headlineDisplay}>Precision Clinical Curator</Text>
            <Text style={styles.panelCaption}>Serif display with contrast and gravity for premium section leads.</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Body</Text>
            <Text style={styles.bodySample}>
              Long-form interpretation for reviewers, coordinators, and board members. Every paragraph keeps a deliberate rhythm and moderate contrast.
            </Text>
            <Text style={[styles.bodySample, styles.bodySampleShort]}>
              A shorter clinical annotation remains equally composed.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Label</Text>
            <Text style={styles.labelSample}>TRIAL STATUS · REVIEW LOCKED</Text>
            <Text style={styles.labelSampleSecondary}>Integrity checkpoint · Updated 08:45 UTC</Text>
            <Text style={styles.panelCaption}>Compact uppercase labels for metadata, chips, and navigation scaffolding.</Text>
          </View>
        </View>

        <SectionHeader
          eyebrow="Buttons"
          title="Structured actions for light and dark contexts"
          body="Buttons stay rectangular with restrained rounding. Emphasis comes from color placement and state contrast rather than decorative shadows."
        />

        <View style={styles.twoColumnGrid}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Light surfaces</Text>
            <View style={styles.buttonRow}>
              <ButtonSample label="Primary" state="Default" variant="primary" />
              <ButtonSample label="Primary" state="Hover" variant="primary" />
              <ButtonSample label="Primary" state="Active" variant="primary" />
            </View>
            <View style={styles.buttonRow}>
              <ButtonSample label="Secondary" state="Default" variant="secondary" />
              <ButtonSample label="Secondary" state="Hover" variant="secondary" />
              <ButtonSample label="Secondary" state="Active" variant="secondary" />
            </View>
          </View>

          <View style={[styles.panel, styles.darkPanel]}>
            <Text style={[styles.panelTitle, styles.darkPanelTitle]}>Dark surfaces</Text>
            <View style={styles.buttonRow}>
              <ButtonSample label="Inverted" state="Default" variant="primary" dark />
              <ButtonSample label="Ghost" state="Hover" variant="ghost" dark />
              <ButtonSample label="Ghost" state="Active" variant="ghost" dark />
            </View>
          </View>
        </View>

        <SectionHeader
          eyebrow="Navigation & Forms"
          title="Thin editorial navigation and neutral clinical inputs"
          body="Horizontal navigation behaves like precise tabs. Form controls maintain low visual noise while preserving hierarchy and a clear active blue."
        />

        <View style={styles.twoColumnGrid}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Top navigation</Text>
            <View style={styles.topNav}>
              <Text style={styles.topNavLogo}>AC</Text>
              <View style={styles.topNavLinks}>
                <Text style={styles.topNavLink}>Research</Text>
                <Text style={[styles.topNavLink, styles.topNavLinkActive]}>Clinical Trials</Text>
                <Text style={styles.topNavLink}>Editorial</Text>
                <Text style={styles.topNavLink}>Archive</Text>
              </View>
            </View>

            <Text style={[styles.panelTitle, styles.embeddedPanelTitle]}>Compact capsule navigation</Text>
            <View style={styles.capsuleNav}>
              <View style={styles.capsuleIcon}>
                <Home color="#7D899D" size={18} strokeWidth={2} />
              </View>
              <View style={[styles.capsuleIcon, styles.capsuleIconActive]}>
                <Search color="#FFFFFF" size={18} strokeWidth={2} />
              </View>
              <View style={styles.capsuleIcon}>
                <CircleUserRound color="#7D899D" size={18} strokeWidth={2} />
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Form controls</Text>
            <Field label="Search" placeholder="Search studies, authors, or protocols" />
            <Field label="Input" placeholder="Enter editorial note or trial identifier" />
            <Field
              label="Select"
              placeholder="Choose review status"
              rightIcon={<ChevronDown color="#5E6C89" size={16} strokeWidth={2} />}
            />
          </View>
        </View>

        <SectionHeader
          eyebrow="Modules"
          title="Dashboard cards and governance blocks with visible hierarchy"
          body="Accent rails, disciplined spacing, and editorial typography help modules feel premium without becoming ornamental."
        />

        <View style={styles.metricsGrid}>
          <MetricCard
            title="Clinical Portal"
            description="Curated entry point for current protocols, board notices, and cohort activity."
            stat="24 active studies"
          />
          <MetricCard
            title="Data Integrity Board"
            description="Exception review, audit trails, and quality assurance across locked submissions."
            stat="03 escalations"
          />
          <MetricCard
            title="Editorial Archive"
            description="Indexed library of guidance, evidence briefs, and historical publication packets."
            stat="148 indexed volumes"
          />
        </View>

        <View style={styles.twoColumnGrid}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Clinical modules</Text>
            <View style={styles.moduleCard}>
              <View style={styles.moduleHeader}>
                <Text style={styles.moduleEyebrow}>Portal cluster</Text>
                <Text style={styles.moduleAction}>Open</Text>
              </View>
              <Text style={styles.moduleTitle}>Clinical Portal</Text>
              <Text style={styles.moduleText}>
                Trial schedules, investigator notes, and compliance checkpoints in a single editorial frame.
              </Text>
              <View style={styles.moduleDivider} />
              <View style={styles.moduleMetaRow}>
                <Text style={styles.moduleMetaLabel}>Queued reviews</Text>
                <Text style={styles.moduleMetaValue}>12</Text>
              </View>
              <View style={styles.moduleMetaRow}>
                <Text style={styles.moduleMetaLabel}>Last board sync</Text>
                <Text style={styles.moduleMetaValue}>09:20</Text>
              </View>
            </View>

            <View style={styles.moduleCard}>
              <View style={styles.moduleHeader}>
                <Text style={styles.moduleEyebrow}>Governance</Text>
                <Text style={styles.moduleAction}>Review</Text>
              </View>
              <Text style={styles.moduleTitle}>Data Integrity Board</Text>
              <Text style={styles.moduleText}>
                Escalated discrepancies are displayed with concise provenance and a reserved action hierarchy.
              </Text>
              <View style={styles.alertRow}>
                <View style={styles.alertIndicator} />
                <Text style={styles.alertText}>2 protocol deviations require sign-off</Text>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Table block</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.tableHeadText, styles.tableColWide]}>Module</Text>
                <Text style={styles.tableHeadText}>Status</Text>
                <Text style={styles.tableHeadText}>Owner</Text>
              </View>
              {[
                ['Clinical Portal', 'Active', 'Dr. Moran'],
                ['Data Integrity Board', 'Escalated', 'R. Singh'],
                ['Editorial Archive', 'Stable', 'E. Laurent'],
              ].map((row) => (
                <View key={row[0]} style={styles.tableRow}>
                  <Text style={[styles.tableCellText, styles.tableColWide]}>{row[0]}</Text>
                  <Text style={styles.tableCellMuted}>{row[1]}</Text>
                  <Text style={styles.tableCellText}>{row[2]}</Text>
                </View>
              ))}
            </View>

            <View style={styles.noteBlock}>
              <Text style={styles.noteLabel}>Layout note</Text>
              <Text style={styles.noteText}>
                Panels stay broad and bright with exact alignment. The interface should always feel curated,
                not decorative.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surface,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  shell: {
    alignSelf: 'center',
    maxWidth: 1280,
    width: '100%',
    gap: 28,
  },
  heroPanel: {
    backgroundColor: paper,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: line,
    padding: 28,
    gap: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#173171',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: sansFamily,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: ink,
  },
  brandMeta: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 18,
    color: mutedInk,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ECF2FF',
  },
  statusBadgeText: {
    fontFamily: sansFamily,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#23449F',
  },
  heroTitle: {
    fontFamily: serifFamily,
    fontSize: 54,
    lineHeight: 60,
    color: ink,
    letterSpacing: -1.2,
  },
  heroBody: {
    maxWidth: 820,
    fontFamily: sansFamily,
    fontSize: 17,
    lineHeight: 28,
    color: mutedInk,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  heroMetaCard: {
    minWidth: 220,
    flexGrow: 1,
    backgroundColor: '#F8FAFD',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  heroMetaLabel: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#73809A',
    fontWeight: '700',
  },
  heroMetaValue: {
    fontFamily: sansFamily,
    fontSize: 15,
    lineHeight: 22,
    color: ink,
  },
  sectionHeader: {
    gap: 6,
    paddingHorizontal: 4,
  },
  eyebrow: {
    fontFamily: sansFamily,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#4865B5',
    fontWeight: '700',
  },
  sectionTitle: {
    fontFamily: serifFamily,
    fontSize: 34,
    lineHeight: 40,
    color: ink,
    letterSpacing: -0.8,
  },
  sectionBody: {
    maxWidth: 820,
    fontFamily: sansFamily,
    fontSize: 15,
    lineHeight: 24,
    color: mutedInk,
  },
  paletteGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  threeColumnGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  panel: {
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: paper,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 24,
    padding: 24,
    gap: 18,
  },
  darkPanel: {
    backgroundColor: deepPanel,
    borderColor: '#284391',
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  panelTitle: {
    fontFamily: sansFamily,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '600',
    color: ink,
  },
  darkPanelTitle: {
    color: '#F4F7FD',
  },
  panelCaption: {
    maxWidth: 420,
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 22,
    color: mutedInk,
  },
  embeddedPanelTitle: {
    marginTop: 6,
  },
  keyChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  keyChipText: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  swatchColumn: {
    width: 76,
    gap: 8,
  },
  swatch: {
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(18,32,67,0.08)',
  },
  swatchToken: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: ink,
  },
  swatchValue: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 16,
    color: mutedInk,
  },
  headlineDisplay: {
    fontFamily: serifFamily,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1.2,
    color: ink,
  },
  bodySample: {
    fontFamily: sansFamily,
    fontSize: 16,
    lineHeight: 27,
    color: '#5F6880',
  },
  bodySampleShort: {
    color: '#7B879A',
  },
  labelSample: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#2648A9',
  },
  labelSampleSecondary: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: '#70809B',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  buttonSample: {
    gap: 10,
    minWidth: 116,
  },
  sampleLabel: {
    fontFamily: sansFamily,
    fontSize: 12,
    lineHeight: 16,
    color: mutedInk,
  },
  buttonBase: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: '#1A3281',
    borderColor: '#1A3281',
  },
  buttonPrimaryOnDark: {
    backgroundColor: '#F5F8FF',
    borderColor: '#F5F8FF',
  },
  buttonSecondary: {
    backgroundColor: '#F9FBFF',
    borderColor: '#1A3281',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: '#AAB8D1',
  },
  buttonGhostOnDark: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  buttonPrimaryLabel: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonSecondaryLabel: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#173171',
  },
  buttonGhostOnDarkLabel: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#F5F8FF',
  },
  buttonHoverState: {
    opacity: 0.92,
    transform: [{ translateY: -1 }],
  },
  buttonActiveState: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E9F1',
  },
  topNavLogo: {
    fontFamily: serifFamily,
    fontSize: 26,
    lineHeight: 32,
    color: '#173171',
  },
  topNavLinks: {
    flexDirection: 'row',
    gap: 18,
    flexWrap: 'wrap',
  },
  topNavLink: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 22,
    color: '#697792',
    paddingBottom: 10,
  },
  topNavLinkActive: {
    color: ink,
    borderBottomWidth: 2,
    borderBottomColor: '#2F6BFF',
  },
  capsuleNav: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    padding: 6,
    gap: 8,
  },
  capsuleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleIconActive: {
    backgroundColor: '#2F6BFF',
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: sansFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#677690',
  },
  fieldControl: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#D8E0EA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  fieldInput: {
    flex: 1,
    fontFamily: sansFamily,
    fontSize: 15,
    lineHeight: 20,
    color: ink,
    paddingVertical: 0,
  },
  fieldIcon: {
    marginLeft: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 250,
    backgroundColor: paper,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 22,
    padding: 22,
    gap: 12,
  },
  metricAccent: {
    width: 52,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#2F6BFF',
  },
  metricTitle: {
    fontFamily: sansFamily,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: ink,
  },
  metricDescription: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 22,
    color: mutedInk,
  },
  metricStat: {
    fontFamily: serifFamily,
    fontSize: 28,
    lineHeight: 32,
    color: '#173171',
  },
  moduleCard: {
    borderRadius: 18,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E0E6EF',
    padding: 18,
    gap: 12,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  moduleEyebrow: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#5A6B87',
  },
  moduleAction: {
    fontFamily: sansFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  moduleTitle: {
    fontFamily: serifFamily,
    fontSize: 28,
    lineHeight: 32,
    color: ink,
  },
  moduleText: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 23,
    color: mutedInk,
  },
  moduleDivider: {
    height: 1,
    backgroundColor: '#DEE5EF',
  },
  moduleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  moduleMetaLabel: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 18,
    color: '#70809B',
  },
  moduleMetaValue: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: ink,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  alertIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2F6BFF',
  },
  alertText: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 18,
    color: ink,
  },
  table: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E6EF',
  },
  tableHead: {
    backgroundColor: '#F1F5FA',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DFE5EE',
    gap: 12,
  },
  tableHeadText: {
    flex: 1,
    fontFamily: sansFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#5C6A84',
  },
  tableCellText: {
    flex: 1,
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 20,
    color: ink,
  },
  tableCellMuted: {
    flex: 1,
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 20,
    color: '#2F6BFF',
  },
  tableColWide: {
    flex: 1.5,
  },
  noteBlock: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#F7FAFD',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    gap: 8,
  },
  noteLabel: {
    fontFamily: sansFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#5B6A84',
  },
  noteText: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 22,
    color: mutedInk,
  },
});
