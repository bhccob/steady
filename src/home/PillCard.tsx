import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { radius, TRACK } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Glass } from '../ui/Glass';
import { GlowPressable } from '../ui/GlowPressable';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';

export interface NextDose {
  id: string;
  label: string;
  timeLabel: string;
  dueMs: number;
}

/** Marking opens an hour before the dose is due. */
const EARLY_MS = 60 * 60_000;
/** The waiting bar fills over 12 hours and stops there. */
const BAR_CAP_MIN = 720;

/** Spec §8.2.1 copy ladder. Never shaming, never red. */
function waitingCopy(lateMin: number): string {
  if (lateMin < 30) return 'on track';
  if (lateMin < 120) return 'still waiting';
  return "it's been a while — no judgment";
}

interface PillCardProps {
  next: NextDose | null;
  nowMs: number;
  hasMeds: boolean;
  /** Shown under the name after a comeback. */
  note?: string;
  onMark: (doseId: string) => void;
  /** With no pills yet, the card itself opens "Add a pill". */
  onAdd: () => void;
}

/** The next dose. Swipe right or tap the round check to mark it taken. */
export function PillCard({ next, nowMs, hasMeds, note, onMark, onAdd }: PillCardProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(300);
  const [x] = useState(() => new Animated.Value(0));
  const markable = next !== null && nowMs >= next.dueMs - EARLY_MS;
  // "Marked" covers the card while Home swaps in the next pill underneath.
  const [confirm] = useState(() => new Animated.Value(0));
  const flash = () =>
    Animated.sequence([
      Animated.timing(confirm, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(confirm, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();

  // The latest props for the gesture handlers, which are made once.
  const live = useRef({ next, width, onMark, markable, reduced });
  useLayoutEffect(() => {
    live.current = { next, width, onMark, markable, reduced };
  });

  // The handlers read `live` only when a swipe happens, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => live.current.markable && g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        const { next: n, width: w, onMark: mark, reduced: still } = live.current;
        if (n && g.dx > w * 0.4) {
          const done = () => {
            flash();
            mark(n.id);
            x.setValue(0);
          };
          if (still) done();
          else Animated.timing(x, { toValue: w, duration: 180, useNativeDriver: false }).start(done);
        } else if (still) x.setValue(0);
        else Animated.spring(x, { toValue: 0, useNativeDriver: false, damping: 18, stiffness: 140 }).start();
      },
      onPanResponderTerminate: () => x.setValue(0),
    }),
  );

  if (!hasMeds) {
    return (
      <GlowPressable radius={radius.card} accessibilityRole="button" accessibilityLabel="Add your first pill" accessibilityHint="Meds, vitamins or supplements" onPress={onAdd}>
        <Glass contentStyle={[styles.card, styles.foot]}>
          <View style={styles.grow}>
            <AppText tone="secondary" variant="caption">
              no pills yet
            </AppText>
            <AppText variant="heading">Add your first pill</AppText>
          </View>
          <View style={[styles.round, { backgroundColor: theme.accent, borderBottomColor: theme.accentDeep, borderBottomWidth: 4 }]}>
            <Icon name="plus" size={22} color={theme.onAccent} />
          </View>
        </Glass>
      </GlowPressable>
    );
  }

  const marked = (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.marked, { backgroundColor: theme.accent, opacity: confirm }]}
    >
      <Icon name="check" size={22} color={theme.onAccent} />
      <AppText variant="bodyStrong" style={{ color: theme.onAccent }}>
        Marked
      </AppText>
    </Animated.View>
  );

  if (!next) {
    return (
      <View>
        <Glass contentStyle={styles.card}>
          <AppText tone="secondary" variant="caption">
            today
          </AppText>
          <AppText variant="heading">All marked for today.</AppText>
        </Glass>
        {marked}
      </View>
    );
  }

  const lateMin = (nowMs - next.dueMs) / 60_000;
  const underWidth = Animated.add(x, 30);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.under, { width: underWidth, backgroundColor: theme.accent }]} pointerEvents="none">
        <View style={styles.underInner}>
          <Icon name="check" size={20} color={theme.onAccent} />
          <AppText variant="bodyStrong" style={{ color: theme.onAccent }}>
            Taken
          </AppText>
        </View>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        <Glass
          contentStyle={styles.card}
          accessibilityActions={markable ? [{ name: 'activate', label: 'Mark taken' }] : undefined}
          onAccessibilityAction={() => {
            if (!markable) return;
            flash();
            onMark(next.id);
          }}
        >
          <View style={styles.top}>
            <View style={styles.grow}>
              <AppText tone="secondary" variant="caption">
                next up
              </AppText>
              <AppText variant="heading" numberOfLines={2}>
                {next.label}
              </AppText>
            </View>
            <AppText tone="secondary">{next.timeLabel}</AppText>
          </View>
          {markable ? (
            <View style={styles.foot}>
              <View style={styles.grow}>
                {lateMin > 0 ? (
                  <View style={[styles.track, { backgroundColor: TRACK }]} accessibilityElementsHidden importantForAccessibility="no">
                    <View style={[styles.fill, { width: `${Math.min(lateMin / BAR_CAP_MIN, 1) * 100}%`, backgroundColor: theme.accentLine }]} />
                  </View>
                ) : null}
                <AppText variant="caption" tone="secondary">
                  {note ?? `${lateMin > 0 ? waitingCopy(lateMin) : 'soon'} · swipe to mark →`}
                </AppText>
              </View>
              <GlowPressable
                radius={25}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${next.label} as taken, due ${next.timeLabel}`}
                onPress={() => {
                  flash();
                  onMark(next.id);
                }}
                style={({ pressed }) => [
                  styles.round,
                  { backgroundColor: theme.accent, borderBottomColor: theme.accentDeep, borderBottomWidth: pressed ? 2 : 4, transform: [{ translateY: pressed ? 2 : 0 }] },
                ]}
              >
                <Icon name="check" size={22} color={theme.onAccent} />
              </GlowPressable>
            </View>
          ) : (
            <AppText variant="caption" tone="secondary">
              {note ?? 'later today'}
            </AppText>
          )}
        </Glass>
      </Animated.View>
      {marked}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  grow: { flex: 1, gap: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 4, borderRadius: 99, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 99 },
  round: { width: 50, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  under: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 28, overflow: 'hidden', justifyContent: 'center' },
  underInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, width: 200 },
  marked: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
