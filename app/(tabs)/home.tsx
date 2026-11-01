import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Mood } from '../../src/db/schema';
import { DaySheet } from '../../src/home/DaySheet';
import { eveningCheckinDue } from '../../src/home/evening';
import { MoodPrompt } from '../../src/home/MoodPrompt';
import { buildPath, indexOfToday, type PathEntry } from '../../src/home/path';
import { BedtimeCard } from '../../src/home/BedtimeCard';
import { ComebackGlow } from '../../src/home/ComebackGlow';
import { RecapCard } from '../../src/home/RecapCard';
import type { SetupStep } from '../../src/home/setup';
import { SetupList } from '../../src/home/SetupList';
import { useSetup } from '../../src/home/useSetup';
import { SteadyHandCard } from '../../src/home/SteadyHandCard';
import { messageUrl, openUrl } from '../../src/lib/contact';
import { PillCard, type NextDose } from '../../src/home/PillCard';
import { hasPills } from '../../src/pills/active';
import { AddedCard } from '../../src/pills/AddedCard';
import { AddPillRow } from '../../src/pills/AddPillRow';
import { markMoment } from '../../src/home/markMoment';
import { StreakPath, type PathMoment } from '../../src/home/StreakPath';
import { useHome } from '../../src/home/useHome';
import { celebrateHaptic, markHaptic } from '../../src/lib/haptics';
import { shortDate } from '../../src/lib/time';
import { playTink, preloadTink } from '../../src/lib/tink';
import { localDateIn } from '../../src/lib/tz';
import { totalPoints, weekLabel, weekStartOf } from '../../src/rewards/trophies';
import { steadyScore } from '../../src/scoring/score';
import { classifyMark } from '../../src/scoring/status';
import { steadyStreak, totalDaysMarked } from '../../src/scoring/streak';
import { useApp } from '../../src/state/app';
import { fonts } from '../../src/theme/fonts';
import { layout } from '../../src/theme/tokens';
import { Background } from '../../src/ui/Background';
import { useTabBarSpace } from '../../src/ui/FloatingTabBar';
import { Glass } from '../../src/ui/Glass';
import { Icon } from '../../src/ui/Icon';
import { LoadProblem } from '../../src/ui/LoadProblem';
import { RollingNumber } from '../../src/ui/RollingNumber';
import { AppText } from '../../src/ui/Text';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const {
    data,
    problem,
    reload,
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
  } = useHome();
  const openHelp = useApp((s) => s.openHelp);
  const openPillSheet = useApp((s) => s.openPillSheet);
  const router = useRouter();
  const setup = useSetup();
  const openStep = (step: SetupStep) => {
    if (step === 'pill') openPillSheet();
    else if (step === 'reminders') setup.turnOn();
    else if (step === 'support') router.push('/edit/support');
    else if (step === 'sleep') router.push({ pathname: '/edit/sleep', params: { suggest: '1' } });
    else router.push({ pathname: '/guardians', params: { add: '1' } });
  };
  const [sheet, setSheet] = useState<{ entry: PathEntry; justCollected: boolean } | null>(null);
  const [moodHandled, setMoodHandled] = useState(false);
  const [eveningHandled, setEveningHandled] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [note, setNote] = useState<string | undefined>();
  const [comebacks, setComebacks] = useState(0);
  /** The latest mark, played on the path: today's block rises in, or glows. */
  const [moment, setMoment] = useState<PathMoment | null>(null);
  const offerHelp = useRef<Promise<boolean>>(Promise.resolve(false));

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(undefined), 5000);
    return () => clearTimeout(t);
  }, [note]);

  const soundOn = data?.profile.markSound === true;
  useEffect(() => {
    if (soundOn) preloadTink();
  }, [soundOn]);

  // At Steady and Close, a dose left open gently offers the help sheet once a day, after the mood question.
  const moodShowing = !!data && !data.checkinToday && !data.moodDismissed && !moodHandled;
  const eveningShowing =
    !!data &&
    !eveningHandled &&
    eveningCheckinDue({
      level: data.profile.supportLevel,
      nowMinutes: data.nowMinutes,
      morningShowing: moodShowing,
      eveningDone: data.eveningDone,
      dismissed: data.eveningDismissed,
    });
  const helpShownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.helpDue || moodShowing || eveningShowing || helpShownFor.current === data.today || useApp.getState().help) return;
    helpShownFor.current = data.today;
    openHelp('overdue');
    noteHelpOffered();
  }, [data, moodShowing, eveningShowing, openHelp, noteHelpOffered]);

  if (!data) return problem ? <LoadProblem what="Home" problem={problem} onRetry={reload} /> : <Background />;

  const { profile, today, nowMs } = data;
  const tz = profile.timezone;
  const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });
  const nowIso = new Date(nowMs).toISOString();

  const entries = buildPath({
    doses: data.doses,
    today,
    firstDay: localDateIn(new Date(profile.createdAt), tz),
    collected: new Set(data.trophies.map((t) => t.weekStart)),
    nowMinutes: data.nowMinutes,
  });
  const todayIdx = indexOfToday(entries);
  const todayEntry = entries[todayIdx];
  const focus = todayEntry?.kind === 'day' && todayEntry.state === 'done' ? todayIdx : Math.max(0, todayIdx - 1);

  const streak = steadyStreak(data.doses, today);
  const score = steadyScore(data.doses, today);
  const marked = totalDaysMarked(data.doses);
  const points = totalPoints({ markedDays: marked, trophiesCollected: data.trophies.length });

  const todays = data.doses.filter((d) => d.dueLocalDate === today).sort((a, b) => (a.dueAtUtc < b.dueAtUtc ? -1 : 1));
  const nextDose = todays.find((d) => d.status === 'pending' && classifyMark(d.dueAtUtc, nowIso) !== null) ?? null;
  const next: NextDose | null = nextDose
    ? { id: nextDose.id, label: data.meds.get(nextDose.medId)?.label ?? 'my pill', timeLabel: clock(nextDose.dueAtUtc), dueMs: Date.parse(nextDose.dueAtUtc) }
    : null;
  const others = todays.filter((d) => d.id !== nextDose?.id);

  const onMark = async (doseId: string) => {
    const kind = markMoment(entries);
    const outcome = await mark(doseId);
    if (!outcome) return;
    setMoment((m) => ({ kind, key: (m?.key ?? 0) + 1, comeback: outcome.comeback }));
    if (outcome.comeback) {
      setNote('there you are.');
      setComebacks((n) => n + 1);
    }
  };

  const onTap = async (i: number) => {
    const e = entries[i];
    if (!e) return;
    if (e.kind === 'trophy' && e.state === 'ready') {
      await collect(e.weekStart, e.daysMarked);
      setSheet({ entry: { ...e, state: 'got' }, justCollected: true });
    } else {
      setSheet({ entry: e, justCollected: false });
    }
  };

  const summary = `${streak} day streak. Steady ${score}. ${marked} days marked. ${points} points.`;

  return (
    <Background>
      <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: tabBarSpace }]}>
        <View style={styles.column}>
          <View style={styles.header}>
            <AppText variant="heading" accessibilityRole="header">
              {profile.displayName.trim() ? `${profile.displayName.trim()}.` : 'Today.'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {shortDate(today)}
            </AppText>
          </View>

          {setup.rows ? <SetupList rows={setup.rows} remindNote={setup.remindNote} onOpen={openStep} onHide={setup.hide} /> : null}

          <View style={styles.hero}>
            <StreakPath
              entries={entries}
              focus={focus}
              onTap={onTap}
              onDragChange={(d) => setScrollEnabled(!d)}
              moment={moment}
              // The buzz, and the tink when it's on, come as the block lands, not as the finger lifts.
              onLanded={(m) => {
                if (m.comeback) celebrateHaptic();
                else markHaptic();
                if (profile.markSound) playTink();
              }}
            />
            <ComebackGlow play={comebacks} />
            <View pointerEvents="none" style={styles.heroText} accessible accessibilityLabel={summary}>
              <View style={styles.streakRow}>
                <RollingNumber value={streak} maxFontSizeMultiplier={1.2} style={styles.streak} />
                <AppText variant="bodyStrong">day streak</AppText>
              </View>
              <AppText variant="caption" tone="secondary">
                Steady {score} · {marked} days marked
              </AppText>
              <AppText variant="caption" tone="secondary">
                This week · {weekLabel(weekStartOf(today))}
              </AppText>
              <Glass variant="pill" style={styles.points} contentStyle={styles.pointsInner}>
                <Icon name="award" size={16} />
                <AppText variant="label">{points} points</AppText>
              </Glass>
            </View>
          </View>

          {data.steadyHand
            ? (() => {
                const { window, doseId, guardian } = data.steadyHand;
                const reach = guardian?.contact ? messageUrl(guardian.channel, guardian.contact) : null;
                return (
                  <SteadyHandCard
                    source={window.source}
                    guardianName={reach ? guardian!.displayName : null}
                    onMark={async () => {
                      await onMark(doseId);
                      steadyHandDone(window.key, false);
                    }}
                    onBreathe={() => {
                      steadyHandDone(window.key, false);
                      router.push('/breathe');
                    }}
                    onReachOut={() => {
                      steadyHandDone(window.key, false);
                      if (reach) openUrl(reach);
                      else openHelp('button');
                    }}
                    onDismiss={() => steadyHandDone(window.key, true)}
                  />
                );
              })()
            : null}

          {data.recap ? <RecapCard line={data.recap} onSeen={recapSeen} /> : null}

          {data.bedtime ? <BedtimeCard kind={data.bedtime} onGoodnight={goodnight} onMoreTime={moreTime} /> : null}

          {/* With no pills yet, the setup list's first step already offers to add one. */}
          {hasPills(data.meds) || !setup.rows ? (
            <PillCard next={next} nowMs={nowMs} hasMeds={hasPills(data.meds)} note={note} onMark={onMark} onAdd={() => openPillSheet()} />
          ) : null}

          <AddedCard />

          {others.map((d) => {
            const taken = d.status === 'taken_ontime' || d.status === 'taken_late';
            return (
              <View key={d.id} style={styles.later}>
                <View style={styles.laterLabel}>
                  {taken ? <Icon name="check" size={16} /> : null}
                  <AppText>{data.meds.get(d.medId)?.label ?? 'my pill'}</AppText>
                </View>
                <AppText tone="secondary">{taken ? `marked ${clock(d.takenAtUtc!)}` : clock(d.dueAtUtc)}</AppText>
              </View>
            );
          })}

          {hasPills(data.meds) ? <AddPillRow onPress={() => openPillSheet()} /> : null}
        </View>
      </ScrollView>

      <MoodPrompt
        visible={moodShowing}
        name={profile.displayName}
        hour={Math.floor(data.nowMinutes / 60)}
        onPick={(m: Mood) => {
          offerHelp.current = pickMood(m);
        }}
        onDismiss={() => {
          dismissMood();
        }}
        onDone={async (m) => {
          setMoodHandled(true);
          if (m === 'rough' && (await offerHelp.current)) {
            // Counts as today's offer, so the overdue sheet doesn't follow right after.
            helpShownFor.current = data.today;
            openHelp('rough');
            noteHelpOffered();
          }
          reload();
        }}
      />

      <MoodPrompt
        evening
        visible={eveningShowing}
        name={profile.displayName}
        hour={Math.floor(data.nowMinutes / 60)}
        onPick={(m: Mood) => {
          offerHelp.current = pickEveningMood(m);
        }}
        onDismiss={() => {
          dismissEvening();
        }}
        onDone={async (m) => {
          setEveningHandled(true);
          if (m === 'rough' && (await offerHelp.current)) {
            helpShownFor.current = data.today;
            openHelp('rough');
            noteHelpOffered();
          }
          reload();
        }}
      />

      <DaySheet
        entry={sheet?.entry ?? null}
        justCollected={sheet?.justCollected ?? false}
        doses={data.doses}
        meds={data.meds}
        today={today}
        nowMs={nowMs}
        clock={clock}
        onMark={async (id) => {
          setSheet(null);
          await onMark(id);
        }}
        onClose={() => setSheet(null)}
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  hero: { height: 340, marginHorizontal: -layout.gutter },
  heroText: { position: 'absolute', left: layout.gutter, top: 2, maxWidth: 180, gap: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  streak: { fontSize: 56, lineHeight: 60, fontFamily: fonts.number, letterSpacing: -1.5 },
  points: { alignSelf: 'flex-start', marginTop: 8 },
  pointsInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 34 },
  later: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  laterLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
