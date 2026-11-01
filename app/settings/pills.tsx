import { StyleSheet, View } from 'react-native';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { scheduleSummary } from '../../src/settings/summary';
import { Row, Section, settingsStyles } from '../../src/settings/ui';
import { useSettingsData } from '../../src/settings/useSettingsData';
import { useApp } from '../../src/state/app';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/ui/Button';

/** Settings > Pills and times: each pill opens its sheet; stopping one keeps its history. */
export default function PillsSettings() {
  const theme = useTheme();
  const openPillSheet = useApp((s) => s.openPillSheet);
  const { data } = useSettingsData();

  return (
    <StepLayout title="Pills and times">
      {data ? (
        <Section>
          {data.meds.map((m) => {
            const s = data.schedules.find((x) => x.medId === m.id);
            const swatch = m.color ?? theme.accent;
            return (
              <Row
                key={m.id}
                label={m.label ?? 'my pill'}
                value={scheduleSummary(s?.times ?? [], s?.days ?? [])}
                onPress={() => openPillSheet(m.id)}
                lead={<View style={[styles.swatch, swatch.startsWith('linear') ? { backgroundImage: swatch } : { backgroundColor: swatch }]} />}
              />
            );
          })}
          <Button variant="link" label="+ Add a pill" onPress={() => openPillSheet()} style={settingsStyles.add} />
        </Section>
      ) : null}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 18, height: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(27, 22, 19, 0.22)' },
});
