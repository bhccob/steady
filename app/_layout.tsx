import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountBridge } from '../src/account/AccountBridge';
import { DB_NAME, migrate } from '../src/db/migrations';
import { usePerfProbe } from '../src/lib/perf';
import { NotificationBridge } from '../src/notify/NotificationBridge';
import { PrivacyGate } from '../src/privacy/PrivacyGate';
import { FONT_FILES } from '../src/theme/fonts';
import { useTheme } from '../src/theme/useTheme';
import { Background } from '../src/ui/Background';
import { useDbLock } from '../src/web/dbLock';
import { opensDatabase } from '../src/web/install';
import { InstallScreen } from '../src/web/InstallScreen';
import { OpenElsewhere } from '../src/web/OpenElsewhere';
import { persistStorage, registerServiceWorker } from '../src/web/startWeb';
import { useInstall } from '../src/web/useInstall';

// Root: migrations run before any screen renders. Biometric gate arrives in P1.
export default function RootLayout() {
  const theme = useTheme();
  const install = useInstall();
  const dbLock = useDbLock(opensDatabase(install.step));
  // The fonts ship with the app, so this takes a moment; if one fails, text falls back to the system font.
  const [fontsLoaded, fontsFailed] = useFonts(FONT_FILES);
  usePerfProbe();
  useEffect(() => {
    registerServiceWorker();
    persistStorage();
  }, []);

  if (!fontsLoaded && !fontsFailed) return <Background />;

  // Web only: install comes first, before this tab takes the database (see install.ts).
  if (!opensDatabase(install.step)) {
    return (
      <SafeAreaProvider>
        <InstallScreen {...install} />
      </SafeAreaProvider>
    );
  }

  // Web only: the database can be open in one tab at a time (see dbLock.ts).
  if (dbLock !== 'held') {
    return <SafeAreaProvider>{dbLock === 'elsewhere' ? <OpenElsewhere /> : <Background />}</SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
        <NotificationBridge />
        <AccountBridge />
        <PrivacyGate />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background[0] } }} />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
