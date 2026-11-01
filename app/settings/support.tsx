import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { View } from 'react-native';

import { updateProfile } from '../../src/db/dao/profile';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { Row, Section, settingsStyles } from '../../src/settings/ui';
import { useSettingsData } from '../../src/settings/useSettingsData';
import { useApp } from '../../src/state/app';
import { LEVEL_NAMES } from '../../src/support/copy';
import { Toggle } from '../../src/ui/Toggle';

/** Settings > My support: what I'm working through, the support level, and my harder times. */
export default function SupportSettings() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { data } = useSettingsData();

  return (
    <StepLayout title="My support">
      {data ? (
        <View style={settingsStyles.pages}>
          <Section>
            <Row label="What I'm working through" value={data.conditionCount ? String(data.conditionCount) : 'None'} onPress={() => router.push('/edit/support')} />
            <Row label="Support level" value={LEVEL_NAMES[data.profile.supportLevel]} onPress={() => router.push('/edit/level')} />
          </Section>

          <Section title="My patterns">
            <Toggle
              label="Show my harder times"
              hint="Your own patterns, shown back to you in the app. Off unless you turn it on."
              value={data.profile.cravingWindowsEnabled}
              onChange={async (on) => {
                await updateProfile(db, { cravingWindowsEnabled: on });
                useApp.getState().bumpData();
              }}
            />
            {data.profile.cravingWindowsEnabled ? (
              <Row label="My harder times" value={data.harderTimeCount ? String(data.harderTimeCount) : 'None set'} onPress={() => router.push('/edit/patterns')} />
            ) : null}
          </Section>
        </View>
      ) : null}
    </StepLayout>
  );
}
