import { authenticateAsync, hasHardwareAsync, isEnrolledAsync } from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { createAccountApi } from '../../src/account/api';
import { ACCOUNT_URL } from '../../src/account/config';
import { clearSession, loadSession } from '../../src/account/session';
import { updateProfile } from '../../src/db/dao/profile';
import { cancelAllScheduledNotificationsAsync, dismissAllNotificationsAsync } from '../../src/lib/notifications';
import { forgetReminders } from '../../src/notify/port';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { useOnboarding } from '../../src/onboarding/store';
import { deleteEverything } from '../../src/settings/data';
import { removeExportFiles, shareExport } from '../../src/settings/exportFile';
import { Note, Row, Section, settingsStyles } from '../../src/settings/ui';
import { useApp } from '../../src/state/app';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';
import { Toggle } from '../../src/ui/Toggle';

const accountApi = createAccountApi(ACCOUNT_URL);

/** Settings > Privacy and data: the lock and app-switcher hiding (phones), export, and deleting everything. */
export default function PrivacySettings() {
  const router = useRouter();
  const db = useSQLiteContext();
  const account = useApp((s) => s.account);
  const privacy = useApp((s) => s.privacy);
  const [lockReady, setLockReady] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Promise.all([hasHardwareAsync(), isEnrolledAsync()])
      .then(([hardware, enrolled]) => setLockReady(hardware && enrolled))
      .catch(() => setLockReady(false));
  }, []);

  const setLock = async (on: boolean) => {
    if (on) {
      if (!lockReady) return;
      // Check it works before relying on it, so nobody locks themselves out.
      const result = await authenticateAsync({ promptMessage: 'Turn on the lock' });
      if (!result.success) return;
    }
    await updateProfile(db, { biometricLock: on });
    useApp.getState().setPrivacy({ ...useApp.getState().privacy, lock: on });
  };

  const setHide = async (on: boolean) => {
    await updateProfile(db, { hideInSwitcher: on });
    useApp.getState().setPrivacy({ ...useApp.getState().privacy, hide: on });
  };

  const exportNow = async () => {
    setNote('');
    try {
      await shareExport(db);
    } catch {
      setNote("Couldn't open the share sheet. Try once more.");
    }
  };

  const confirmed = confirmWord.trim().toLowerCase() === 'delete';

  const deleteAll = async () => {
    if (!confirmed) return;
    setDeleting(false);
    // Signed in? Sign out here too, so setting up again can't overwrite the backup with a fresh start.
    const session = await loadSession();
    if (session) {
      await accountApi.signOut(session.token).catch(() => {});
      await clearSession();
      useApp.getState().setAccount(null);
    }
    await deleteEverything(db);
    removeExportFiles();
    await cancelAllScheduledNotificationsAsync().catch(() => {});
    await dismissAllNotificationsAsync().catch(() => {});
    await forgetReminders().catch(() => {});
    useOnboarding.getState().reset();
    useApp.getState().setPrivacy({ lock: false, hide: false });
    router.dismissAll();
    router.replace('/onboarding');
  };

  return (
    <>
      <StepLayout title="Privacy and data">
        <View style={settingsStyles.pages}>
          {/* The web has no face or fingerprint lock and no app switcher to hide from. */}
          {Platform.OS === 'web' ? null : (
            <Section title="Privacy">
              <Toggle
                label="Lock with face or fingerprint"
                hint={lockReady === false ? 'Set up face or fingerprint unlock on your phone first.' : 'Asks when Steady opens, or after it has been away a while.'}
                value={privacy.lock}
                onChange={setLock}
              />
              <Toggle
                label="Hide in app switcher"
                hint={Platform.OS === 'ios' ? 'Blurs Steady in the app switcher.' : 'Shows a blank preview. On Android this also blocks screenshots.'}
                value={privacy.hide}
                onChange={setHide}
              />
            </Section>
          )}

          <Section title="Your data">
            <Row label="Export my data" value="JSON" onPress={exportNow} />
            <Row
              label="Delete everything"
              onPress={() => {
                setConfirmWord('');
                setDeleting(true);
              }}
            />
            <Note text={note} />
          </Section>
        </View>
      </StepLayout>

      <BottomSheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        title="Delete everything?"
        subtitle={`This removes your pills, doses, moods and guardians from this phone. It can't be undone.${account ? " Your backup on Steady's server stays until you delete your account." : ''}`}
      >
        <View style={settingsStyles.sheetBody}>
          <Button variant="link" label="Export my data first" onPress={exportNow} style={settingsStyles.add} />
          <TextField label={'Type "delete" to confirm'} placeholder="delete" value={confirmWord} onChangeText={setConfirmWord} autoCapitalize="none" autoCorrect={false} />
          <Button
            label="Delete everything"
            onPress={deleteAll}
            accessibilityHint={confirmed ? undefined : 'Type delete first'}
            style={confirmed ? undefined : settingsStyles.dim}
          />
          <Button variant="secondary" label="Keep my data" onPress={() => setDeleting(false)} />
        </View>
      </BottomSheet>
    </>
  );
}
