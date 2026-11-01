import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';

import { updateProfile } from '../../src/db/dao/profile';
import { formatHm } from '../../src/lib/time';
import { playTink } from '../../src/lib/tink';
import { remindersOn, syncSoon, turnOnReminders } from '../../src/notify/port';
import { turnOnProblem } from '../../src/notify/turnOnProblem';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { Row, Section, settingsStyles } from '../../src/settings/ui';
import { useSettingsData } from '../../src/settings/useSettingsData';
import { useApp } from '../../src/state/app';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { Button } from '../../src/ui/Button';
import { AppText } from '../../src/ui/Text';
import { TimeStepper } from '../../src/ui/TimeStepper';
import { Toggle } from '../../src/ui/Toggle';

/** Settings > Reminders and sound: this device's reminders (web), quiet hours, bedtime, the tink. */
export default function RemindersSettings() {
  const router = useRouter();
  const db = useSQLiteContext();
  const account = useApp((s) => s.account);
  const { data, reload } = useSettingsData();
  const [quietOpen, setQuietOpen] = useState(false);
  const [quiet, setQuiet] = useState({ startMin: 1320, endMin: 420 });
  // Web only: whether this device's reminders are turned on, and why not when turning on fails.
  const [webReminders, setWebReminders] = useState<boolean | null>(null);
  const [remindNote, setRemindNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') remindersOn().then(setWebReminders, () => setWebReminders(false));
    }, []),
  );

  if (!data) return <StepLayout title="Reminders and sound" />;
  const { profile } = data;

  const turnOn = async () => {
    setRemindNote('');
    const result = await turnOnReminders().catch(() => 'unsupported' as const);
    if (result === 'on') {
      setWebReminders(true);
      syncSoon(db);
    } else {
      setRemindNote(turnOnProblem(result, true));
    }
  };

  const saveQuiet = async () => {
    await updateProfile(db, { quietStartMin: quiet.startMin, quietEndMin: quiet.endMin });
    setQuietOpen(false);
    syncSoon(db);
    reload();
  };

  const setSound = async (on: boolean) => {
    await updateProfile(db, { markSound: on });
    // Turning it on plays it once, so it's clear what it is.
    if (on) playTink();
    useApp.getState().bumpData();
  };

  return (
    <>
      <StepLayout title="Reminders and sound">
        <View style={settingsStyles.pages}>
          <Section>
            {Platform.OS === 'web' ? (
              <>
                <Row label="On this device" value={webReminders ? 'On' : 'Off, tap to turn on'} onPress={webReminders ? undefined : turnOn} />
                {remindNote ? (
                  <AppText variant="caption" tone="secondary" style={settingsStyles.note}>
                    {remindNote}
                  </AppText>
                ) : null}
              </>
            ) : null}
            <Row
              label="Quiet hours"
              value={`${formatHm(profile.quietStartMin)} to ${formatHm(profile.quietEndMin)}`}
              onPress={() => {
                setQuiet({ startMin: profile.quietStartMin, endMin: profile.quietEndMin });
                setQuietOpen(true);
              }}
            />
            <Row label="Bedtime reminders" value={profile.bedtimeMin == null ? 'Off' : `Bed ${formatHm(profile.bedtimeMin)}`} onPress={() => router.push('/edit/sleep')} />
            {Platform.OS === 'web' ? (
              <AppText variant="caption" tone="secondary" style={settingsStyles.note}>
                {account
                  ? "Steady's server keeps when your reminders are due. You're signed in, so Steady's server also keeps your backup."
                  : "Steady's server keeps only when your reminders are due. Never your name, pills or moods."}
              </AppText>
            ) : null}
          </Section>

          <Section title="Sound">
            <Toggle label="Sound when marking" hint="A soft tink as the day's block lands on your path." value={profile.markSound} onChange={setSound} />
          </Section>
        </View>
      </StepLayout>

      <BottomSheet
        visible={quietOpen}
        onClose={() => setQuietOpen(false)}
        title="Quiet hours"
        subtitle="Follow-up reminders wait until quiet hours end. Each dose's first reminder still comes at its time."
      >
        <View style={settingsStyles.sheetBody}>
          <View>
            <TimeStepper label="From" value={quiet.startMin} onChange={(v) => setQuiet({ ...quiet, startMin: v })} />
            <TimeStepper label="Until" value={quiet.endMin} onChange={(v) => setQuiet({ ...quiet, endMin: v })} />
          </View>
          <Button label="Save" onPress={saveQuiet} />
        </View>
      </BottomSheet>
    </>
  );
}
