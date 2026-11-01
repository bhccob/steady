import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getCheckin, getEveningCheckin, listCheckins, upsertCheckin, upsertEveningCheckin, type Checkin } from '../db/dao/checkins';
import { listDosesBetween, type Dose } from '../db/dao/doses';
import { countEventsSince, eventsSince, hasEventForDate, latestEventTime, logEvent } from '../db/dao/events';
import { listGuardians, type Guardian } from '../db/dao/guardians';
import { listHarderTimes } from '../db/dao/harderTimes';
import { listMeds, type Med } from '../db/dao/meds';
import { getProfile, type Profile } from '../db/dao/profile';
import { collectTrophy, listTrophies, type CollectedTrophy } from '../db/dao/trophies';
import type { Mood } from '../db/schema';
import type { Db } from '../db/types';
import { reconcileDoses } from '../doses/reconcile';
import { celebrateHaptic, lightHaptic } from '../lib/haptics';
import { loadData } from '../lib/loadData';
import { addDays, DAY_MS, inQuietHours, MINUTE_MS, type LocalDate } from '../lib/time';
import { localDateIn, localMinutesIn, zonedTimeToUtc } from '../lib/tz';
import { activePort, syncSoon } from '../notify/port';
import { steadyHandDue, windowsFor, type Window } from '../patterns/windows';
import { weekStartOf } from '../rewards/trophies';
import { useApp } from '../state/app';
import { LEVEL_RULES } from '../support/level';
import { refreshWidget } from '../widget/refresh';
import { bedtimeCard, type BedtimeCard } from './bedtime';
import { shouldOfferHelp } from './help';
import { markDose, type MarkOutcome } from './markDose';
import { recapDue, recapLine, weeklyRecap } from './recap';

const REFRESH_MS = 5 * MINUTE_MS;
const LONG_OVERDUE_MS = 120 * MINUTE_MS;

/** Everything the Steady Hand rules need, read from the database (spec §6). */
async function loadSteadyHand(db: Db, input: { profile: Profile; today: LocalDate; now: Date; doses: Dose[] }): Promise<HomeData['steadyHand']> {
  const { profile, today, now, doses } = input;
  const tz = profile.timezone;
  const nowMs = now.getTime();
  const open = doses
    .filter((d) => d.dueLocalDate === today && d.status === 'pending' && Date.parse(d.dueAtUtc) <= nowMs)
    .sort((a, b) => (a.dueAtUtc < b.dueAtUtc ? -1 : 1));
  const oldest = open[0];
  if (!oldest) return null;

  const roughMoods = (await listCheckins(db))
    .filter((c) => c.mood === 'rough')
    .map((c) => ({ date: c.dateLocal, minutes: localMinutesIn(new Date(c.createdAt), tz) }));
  const windows = windowsFor({
    date: today,
    today,
    firstDay: localDateIn(new Date(profile.createdAt), tz),
    timezone: tz,
    harderTimes: await listHarderTimes(db),
    roughMoods,
    doses,
  });
  const lastMark = doses.reduce((max, d) => (d.takenAtUtc && d.takenAtUtc > max ? d.takenAtUtc : max), '');
  const dayAgo = new Date(nowMs - DAY_MS).toISOString();
  const shownToday = new Set(
    ((await eventsSince(db, 'steady_hand_shown', dayAgo)) as { date: string; key: string }[]).filter((e) => e.date === today).map((e) => e.key),
  );
  const weekStart = zonedTimeToUtc(weekStartOf(today), '00:00', tz);
  const nowMinutes = localMinutesIn(now, tz);

  const window = steadyHandDue({
    enabled: profile.cravingWindowsEnabled,
    windows,
    nowMinutes,
    overdueMin: (nowMs - Date.parse(oldest.dueAtUtc)) / MINUTE_MS,
    inQuiet: inQuietHours(nowMinutes, profile.quietStartMin, profile.quietEndMin),
    minutesSinceMark: lastMark ? (nowMs - Date.parse(lastMark)) / MINUTE_MS : null,
    shownToday,
    dismissalsThisWeek: (await eventsSince(db, 'steady_hand_dismissed', weekStart)).length,
  });
  if (!window) return null;
  const guardian = (await listGuardians(db)).find((g) => g.consentedAt && g.contact) ?? null;
  return { window, doseId: oldest.id, guardian };
}

export interface HomeData {
  profile: Profile;
  today: LocalDate;
  nowMs: number;
  nowMinutes: number;
  doses: Dose[];
  meds: Map<string, Med>;
  checkinToday: Checkin | null;
  moodDismissed: boolean;
  /** Close's evening check-in: answered, or put off with "Not now", today. */
  eveningDone: boolean;
  eveningDismissed: boolean;
  trophies: CollectedTrophy[];
  bedtime: BedtimeCard;
  /** A dose has been open long enough for this support level to offer the help sheet. */
  helpDue: boolean;
  /** The harder-time window to show the Steady Hand card for (spec §6), with what its buttons act on. */
  steadyHand: { window: Window; doseId: string; guardian: Guardian | null } | null;
  /** Sunday's recap line, until seen (spec §12.7). */
  recap: string | null;
}

/** Loads Home from the database and refreshes on focus and on return to the foreground (spec §3.5). */
export function useHome() {
  const db = useSQLiteContext();
  const setSupportLevel = useApp((s) => s.setSupportLevel);
  const [data, setData] = useState<HomeData | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const read = useCallback(async (): Promise<HomeData | null> => {
    const profile = await getProfile(db);
    if (!profile) return null;
    const now = new Date();
    const tz = profile.timezone;
    await reconcileDoses(db, { now: now.toISOString(), timezone: tz, notBefore: profile.createdAt });
    syncSoon(db);
    const today = localDateIn(now, tz);
    const doses = await listDosesBetween(db, '0000-01-01', addDays(today, 21));
    const meds = new Map((await listMeds(db, { includeInactive: true })).map((m) => [m.id, m]));
    const checkinToday = await getCheckin(db, today);
    const moodDismissed = await hasEventForDate(db, 'mood_prompt_dismissed', today);
    const eveningDone = (await getEveningCheckin(db, today)) !== null;
    const eveningDismissed = await hasEventForDate(db, 'evening_prompt_dismissed', today);
    const trophies = await listTrophies(db);
    const { bedtimeMin, wakeMin } = profile;
    const bedtime = bedtimeCard({
      now: now.toISOString(),
      timezone: tz,
      sleep: bedtimeMin !== null && wakeMin !== null ? { bedtimeMin, wakeMin } : null,
      goodnightAt: await latestEventTime(db, 'goodnight'),
      snoozedAt: await latestEventTime(db, 'bedtime_snoozed'),
    });
    const helpDue = shouldOfferHelp({
      level: profile.supportLevel,
      doses: doses.filter((d) => d.dueLocalDate === today),
      now: now.toISOString(),
      offeredToday: await hasEventForDate(db, 'help_offered', today),
    });
    const steadyHand = profile.cravingWindowsEnabled ? await loadSteadyHand(db, { profile, today, now, doses }) : null;
    const week = weekStartOf(today);
    const recap = recapDue({ today, nowMinutes: localMinutesIn(now, tz), seenThisWeek: await hasEventForDate(db, 'recap_seen', week) })
      ? recapLine(weeklyRecap({ doses, today, comebacks: await countEventsSince(db, 'comeback', zonedTimeToUtc(week, '00:00', tz)) }))
      : null;
    setSupportLevel(profile.supportLevel);
    useApp.getState().setCrisisRegion(profile.crisisRegion);
    useApp
      .getState()
      .setLongOverdue(doses.some((d) => d.dueLocalDate === today && d.status === 'pending' && now.getTime() - Date.parse(d.dueAtUtc) >= LONG_OVERDUE_MS));
    return {
      profile,
      today,
      nowMs: now.getTime(),
      nowMinutes: localMinutesIn(now, tz),
      doses,
      meds,
      checkinToday,
      moodDismissed,
      eveningDone,
      eveningDismissed,
      trophies,
      bedtime,
      helpDue,
      steadyHand,
      recap,
    };
  }, [db, setSupportLevel]);

  const load = useCallback(async () => {
    const result = await loadData(read);
    if ('data' in result) {
      setData(result.data);
      refreshWidget(db).catch(() => {});
    }
    setProblem('data' in result ? null : result.problem);
  }, [db, read]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  // While Home stays open: the waiting bar moves on, and a new day starts after midnight (spec §3.5).
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // A notification button can change doses while Home is showing.
  useEffect(() => useApp.subscribe((s, prev) => s.dataVersion !== prev.dataVersion && load()), [load]);

  const mark = useCallback(
    async (doseId: string): Promise<MarkOutcome | null> => {
      // No haptic here: Home buzzes as today's block lands on the path.
      const outcome = await markDose(db, { doseId, nowUtc: new Date().toISOString() });
      activePort.dismiss([doseId]).catch(() => {});
      await load(); // re-syncs reminders, cancelling the rest for this dose
      return outcome;
    },
    [db, load],
  );

  /** Saves today's mood. Returns true when the reach-out sheet should be offered. */
  const pickMood = useCallback(
    async (mood: Mood): Promise<boolean> => {
      if (!data) return false;
      lightHaptic();
      await upsertCheckin(db, data.today, mood);
      if (mood !== 'rough') return false;
      const rule = LEVEL_RULES[data.profile.supportLevel].helpOnRough;
      if (rule === 'right_away') return true;
      return (await getCheckin(db, addDays(data.today, -1)))?.mood === 'rough';
    },
    [db, data],
  );

  const dismissMood = useCallback(async () => {
    if (data) await logEvent(db, 'mood_prompt_dismissed', { date: data.today });
  }, [db, data]);

  /** Saves the evening mood. Returns true when the reach-out sheet should be offered. */
  const pickEveningMood = useCallback(
    async (mood: Mood): Promise<boolean> => {
      if (!data) return false;
      lightHaptic();
      await upsertEveningCheckin(db, data.today, mood);
      if (mood !== 'rough') return false;
      return LEVEL_RULES[data.profile.supportLevel].helpOnRough === 'right_away' || data.checkinToday?.mood === 'rough';
    },
    [db, data],
  );

  const dismissEvening = useCallback(async () => {
    if (data) await logEvent(db, 'evening_prompt_dismissed', { date: data.today });
  }, [db, data]);

  const collect = useCallback(
    async (weekStart: LocalDate, daysMarked: number) => {
      if (await collectTrophy(db, weekStart, daysMarked)) celebrateHaptic();
      await load();
    },
    [db, load],
  );

  /** Goodnight: quiet until wake-up. Same as the notification button. */
  const goodnight = useCallback(async () => {
    lightHaptic();
    await logEvent(db, 'goodnight', { at: new Date().toISOString() });
    syncSoon(db);
    await load();
  }, [db, load]);

  /** "15 more min": the card and the next nudge wait 15 minutes. */
  const moreTime = useCallback(async () => {
    await logEvent(db, 'bedtime_snoozed', { at: new Date().toISOString() });
    syncSoon(db);
    await load();
  }, [db, load]);

  /** The Steady Hand card was acted on or put away: not again in this window today. A put-away counts toward two a week. */
  const steadyHandDone = useCallback(
    async (key: string, dismissed: boolean) => {
      if (!data) return;
      const at = new Date().toISOString();
      await logEvent(db, 'steady_hand_shown', { at, date: data.today, key });
      if (dismissed) await logEvent(db, 'steady_hand_dismissed', { at });
      await load();
    },
    [db, data, load],
  );

  const recapSeen = useCallback(async () => {
    if (!data) return;
    await logEvent(db, 'recap_seen', { date: weekStartOf(data.today) });
    await load();
  }, [db, data, load]);

  /** The overdue help sheet was shown today; don't offer it again until tomorrow. */
  const noteHelpOffered = useCallback(async () => {
    if (data) await logEvent(db, 'help_offered', { date: data.today });
  }, [db, data]);

  return {
    data,
    problem,
    reload: load,
    mark,
    pickMood,
    dismissMood,
    pickEveningMood,
    dismissEvening,
    collect,
    goodnight,
    moreTime,
    noteHelpOffered,
    steadyHandDone,
    recapSeen,
  };
}
