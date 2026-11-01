import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HAIRLINE } from '../theme/tokens';
import { Icon } from '../ui/Icon';
import { AppText } from '../ui/Text';

// The pieces every Settings page is made of: hairline rows under small section labels.

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={settingsStyles.section}>
      {title ? (
        <AppText variant="label" tone="secondary" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      <View>{children}</View>
    </View>
  );
}

export function Row({ label, value, onPress, lead }: { label: string; value?: string; onPress?: () => void; lead?: ReactNode }) {
  const body = (
    <>
      {lead}
      <AppText style={settingsStyles.grow}>{label}</AppText>
      {value ? (
        <AppText tone="secondary" style={settingsStyles.value} numberOfLines={2}>
          {value}
        </AppText>
      ) : null}
      {onPress ? <Icon name="chevron-right" size={18} /> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={settingsStyles.row}>
      {body}
    </Pressable>
  ) : (
    <View style={settingsStyles.row} accessible accessibilityLabel={value ? `${label}, ${value}` : label}>
      {body}
    </View>
  );
}

/** A message under a section, read out when it appears. */
export function Note({ text }: { text: string }) {
  return text ? (
    <AppText variant="caption" accessibilityRole="alert" style={settingsStyles.note}>
      {text}
    </AppText>
  ) : null;
}

export const settingsStyles = StyleSheet.create({
  section: { gap: 4 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  grow: { flex: 1 },
  value: { maxWidth: '55%', textAlign: 'right' },
  add: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  note: { marginTop: 8 },
  sheetBody: { gap: 12, marginTop: 8 },
  dim: { opacity: 0.45 },
  pages: { gap: 22 },
});
