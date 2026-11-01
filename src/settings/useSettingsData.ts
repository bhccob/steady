import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { listHarderTimes } from '../db/dao/harderTimes';
import { listMeds, type Med } from '../db/dao/meds';
import { getProfile, type Profile } from '../db/dao/profile';
import { listSchedules, type Schedule } from '../db/dao/schedules';
import { listConditions } from '../db/dao/support';
import { loadData } from '../lib/loadData';
import { useApp } from '../state/app';

export interface SettingsData {
  profile: Profile;
  meds: Med[];
  schedules: Schedule[];
  conditionCount: number;
  harderTimeCount: number;
}

/** What Settings and its pages show, read again on focus and whenever data changes. */
export function useSettingsData() {
  const db = useSQLiteContext();
  const [data, setData] = useState<SettingsData | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // "Backed up 2 min ago" counts from when the page last loaded.
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const reload = useCallback(async () => {
    setLoadedAt(Date.now());
    const result = await loadData(async (): Promise<SettingsData | null> => {
      const profile = await getProfile(db);
      if (!profile) return null;
      return {
        profile,
        meds: await listMeds(db),
        schedules: await listSchedules(db),
        conditionCount: (await listConditions(db)).length,
        harderTimeCount: (await listHarderTimes(db)).length,
      };
    });
    if ('data' in result) setData(result.data);
    setProblem('data' in result ? null : result.problem);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(() => useApp.subscribe((s, prev) => s.dataVersion !== prev.dataVersion && reload()), [reload]);

  return { data, problem, reload, loadedAt };
}
