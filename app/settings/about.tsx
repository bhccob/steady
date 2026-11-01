import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';

import { StepLayout } from '../../src/onboarding/StepLayout';
import { Row, Section, settingsStyles } from '../../src/settings/ui';
import { useApp } from '../../src/state/app';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { AppText } from '../../src/ui/Text';

/** Settings > About: crisis lines, the safety note, and the version. */
export default function AboutSettings() {
  const openHelp = useApp((s) => s.openHelp);
  const [disclaimer, setDisclaimer] = useState(false);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <>
      <StepLayout title="About">
        <Section>
          <Row label="Crisis lines" onPress={() => openHelp('button')} />
          <Row label="Not medical advice" onPress={() => setDisclaimer(true)} />
          <Row label="Version" value={version} />
        </Section>
      </StepLayout>

      <BottomSheet visible={disclaimer} onClose={() => setDisclaimer(false)} title="Not medical advice">
        <View style={settingsStyles.sheetBody}>
          <AppText>{"Steady helps you keep track. It isn't medical advice, and it doesn't replace care from your doctor or pharmacist."}</AppText>
          <AppText>Change or stop a medication only with them.</AppText>
          <AppText>If things feel like too much, a free crisis line is always two taps from Home.</AppText>
        </View>
      </BottomSheet>
    </>
  );
}
