import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts } from '../theme/fonts';
import { MAX_FONT_SCALE, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { AppText } from './Text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, ...input }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        placeholderTextColor={theme.text.secondary}
        style={[
          styles.input,
          { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border, color: theme.text.primary },
        ]}
        {...input}
      />
      {hint ? (
        <AppText variant="caption" tone="secondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: fonts.text },
});
