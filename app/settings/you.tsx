import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { AccountError, createAccountApi } from '../../src/account/api';
import { ACCOUNT_URL } from '../../src/account/config';
import { savedAgo } from '../../src/account/savedAgo';
import { clearSession, loadSession } from '../../src/account/session';
import { updateProfile } from '../../src/db/dao/profile';
import { syncSoon } from '../../src/notify/port';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { Note, Row, Section, settingsStyles } from '../../src/settings/ui';
import { useSettingsData } from '../../src/settings/useSettingsData';
import { useApp } from '../../src/state/app';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';

type Sheet = 'name' | 'signout' | 'signoutAll' | 'deleteAccount' | null;

const accountApi = createAccountApi(ACCOUNT_URL);
const TRY_AGAIN = "That didn't go through. Check your connection and try again.";

/** Settings > You: name, account and backup, signing out, and deleting the account. */
export default function YouSettings() {
  const router = useRouter();
  const db = useSQLiteContext();
  const account = useApp((s) => s.account);
  const { data, loadedAt } = useSettingsData();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [accountNote, setAccountNote] = useState('');

  const open = (s: Sheet) => {
    setName(data?.profile.displayName ?? '');
    setConfirmWord('');
    setSheet(s);
  };

  const saveName = async () => {
    await updateProfile(db, { displayName: name.trim() });
    setSheet(null);
    syncSoon(db);
    useApp.getState().bumpData();
  };

  /** Signs out here, or everywhere. If the server already forgot this device, it signs out here anyway. */
  const signOut = async (everywhere: boolean) => {
    setSheet(null);
    setAccountNote('');
    const session = await loadSession();
    try {
      if (session) await (everywhere ? accountApi.signOutEverywhere(session.token) : accountApi.signOut(session.token));
    } catch (e) {
      if (!(e instanceof AccountError && e.status === 401)) {
        setAccountNote(TRY_AGAIN);
        return;
      }
    }
    await clearSession();
    useApp.getState().setAccount(null);
    setAccountNote(everywhere ? 'Signed out on every device. Your data stays on each one.' : 'Signed out. Your data stays on this device.');
  };

  const deleteAccount = async () => {
    if (confirmWord.trim().toLowerCase() !== 'delete') return;
    setSheet(null);
    setAccountNote('');
    const session = await loadSession();
    try {
      if (session) await accountApi.deleteAccount(session.token);
    } catch (e) {
      if (!(e instanceof AccountError && e.status === 401)) {
        setAccountNote(TRY_AGAIN);
        return;
      }
    }
    await clearSession();
    useApp.getState().setAccount(null);
    setAccountNote('Your account and backups are deleted from the server. Your data stays on this device.');
  };

  /** Another device took the backup over; make this one the backup again. */
  const useThisPhone = async () => {
    setAccountNote('');
    const session = await loadSession();
    if (!session) return;
    try {
      await accountApi.claim(session.token);
      useApp.getState().setAccount({ email: session.email, savedAt: session.savedAt, state: 'ok' });
      await useApp.getState().backupNow();
    } catch {
      setAccountNote(TRY_AGAIN);
    }
  };

  const confirmed = confirmWord.trim().toLowerCase() === 'delete';

  return (
    <>
      <StepLayout title="You">
        {data ? (
          <View style={settingsStyles.pages}>
            <Section>
              <Row label="Name" value={data.profile.displayName.trim() || 'Not set'} onPress={() => open('name')} />
            </Section>

            <Section title="Account">
              {account ? (
                <>
                  <Row label="Email" value={account.email} />
                  {account.state === 'elsewhere' ? (
                    <>
                      <Row label="Backup" value="Your backup is now on another device" />
                      <Button variant="link" label="Use this phone" onPress={useThisPhone} style={settingsStyles.add} />
                    </>
                  ) : (
                    <Row
                      label="Backup"
                      value={`${account.savedAt === null ? 'not saved yet' : `saved ${savedAgo(account.savedAt, loadedAt)}`}${account.state === 'offline' ? ', will retry' : ''}`}
                      onPress={() => useApp.getState().backupNow()}
                    />
                  )}
                  <Row label="Sign out" onPress={() => open('signout')} />
                  <Row label="Sign out everywhere" onPress={() => open('signoutAll')} />
                </>
              ) : (
                <Row label="Back up with email" value="Optional" onPress={() => router.push({ pathname: '/account/email', params: { from: 'settings' } })} />
              )}
              <Note text={accountNote} />
            </Section>

            {account ? (
              <Section>
                <Row label="Delete my account" onPress={() => open('deleteAccount')} />
              </Section>
            ) : null}
          </View>
        ) : null}
      </StepLayout>

      <BottomSheet visible={sheet === 'name'} onClose={() => setSheet(null)} title="Your name" subtitle="A first name or a nickname. Reminders use it.">
        <View style={settingsStyles.sheetBody}>
          <TextField label="Your name" placeholder="sam" value={name} onChangeText={setName} maxLength={40} autoComplete="given-name" />
          <Button label="Save" onPress={saveName} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'signout'} onClose={() => setSheet(null)} title="Sign out?" subtitle="Your data stays on this device. Backups stop until you sign in again.">
        <View style={settingsStyles.sheetBody}>
          <Button label="Sign out" onPress={() => signOut(false)} />
          <Button variant="secondary" label="Stay signed in" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'signoutAll'}
        onClose={() => setSheet(null)}
        title="Sign out everywhere?"
        subtitle="Every phone and browser signed in to this account is signed out, this one too. The data on each stays."
      >
        <View style={settingsStyles.sheetBody}>
          <Button label="Sign out everywhere" onPress={() => signOut(true)} />
          <Button variant="secondary" label="Stay signed in" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'deleteAccount'}
        onClose={() => setSheet(null)}
        title="Delete your account?"
        subtitle="This removes your account and backups from Steady's server. The data on this device stays. It can't be undone."
      >
        <View style={settingsStyles.sheetBody}>
          <TextField label={'Type "delete" to confirm'} placeholder="delete" value={confirmWord} onChangeText={setConfirmWord} autoCapitalize="none" autoCorrect={false} />
          <Button
            label="Delete my account"
            onPress={deleteAccount}
            accessibilityHint={confirmed ? undefined : 'Type delete first'}
            style={confirmed ? undefined : settingsStyles.dim}
          />
          <Button variant="secondary" label="Keep my account" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>
    </>
  );
}
