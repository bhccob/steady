import { useRouter, type Href } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountLine, pillsLine, quietLine } from '../../src/settings/overview';
import { Row, Section } from '../../src/settings/ui';
import { useSettingsData } from '../../src/settings/useSettingsData';
import { useApp } from '../../src/state/app';
import { LEVEL_NAMES } from '../../src/support/copy';
import { layout } from '../../src/theme/tokens';
import { Background } from '../../src/ui/Background';
import { useTabBarSpace } from '../../src/ui/FloatingTabBar';
import { Icon, type IconName } from '../../src/ui/Icon';
import { LoadProblem } from '../../src/ui/LoadProblem';
import { AppText } from '../../src/ui/Text';

/** Settings' first page: six rows, each opening its own page (app/settings/*). */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();
  const account = useApp((s) => s.account);
  const { data, problem, reload, loadedAt } = useSettingsData();

  if (!data) return problem ? <LoadProblem what="Settings" problem={problem} onRetry={reload} /> : <Background />;
  const { profile } = data;

  const rows: { label: string; value?: string; icon: IconName; href: Href }[] = [
    { label: profile.displayName.trim() || 'You', value: accountLine(account, loadedAt), icon: 'user', href: '/settings/you' },
    { label: 'Pills and times', value: pillsLine(data.meds.length), icon: 'plus-circle', href: '/settings/pills' },
    { label: 'Reminders and sound', value: quietLine(profile.quietStartMin, profile.quietEndMin), icon: 'bell', href: '/settings/reminders' },
    { label: 'My support', value: LEVEL_NAMES[profile.supportLevel], icon: 'heart', href: '/settings/support' },
    { label: 'Privacy and data', icon: 'lock', href: '/settings/privacy' },
    { label: 'About', icon: 'info', href: '/settings/about' },
  ];

  return (
    <Background>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: tabBarSpace }]}>
        <View style={styles.column}>
          <AppText variant="title" accessibilityRole="header">
            Settings
          </AppText>
          <Section>
            {rows.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} lead={<Icon name={r.icon} size={20} />} onPress={() => router.push(r.href)} />
            ))}
          </Section>
          <AppText variant="caption" tone="secondary" style={styles.footer}>
            {account
              ? "You're signed in, so Steady's server keeps your backup. No tracking."
              : Platform.OS === 'web'
                ? 'Everything stays on this phone except your reminder times. No account, no tracking.'
                : 'Everything stays on this phone. No account, no tracking.'}
          </AppText>
        </View>
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: 22 },
  footer: { textAlign: 'center' },
});
