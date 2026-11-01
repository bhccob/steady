import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { fontFamilyFor } from '../theme/fonts';
import { MAX_FONT_SCALE, typeScale } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface AppTextProps extends TextProps {
  variant?: keyof typeof typeScale;
  tone?: 'primary' | 'secondary';
}

/** Themed text that scales with Dynamic Type up to 200%. Place it inside a Glass core. */
export function AppText({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  // The weight a style asks for picks the font file (see fonts.ts); a family set by the caller wins.
  const flat: TextStyle = StyleSheet.flatten([typeScale[variant], style]) ?? {};
  const fontFamily = flat.fontFamily ?? fontFamilyFor(variant, flat.fontWeight);
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[typeScale[variant], { color: theme.text[tone] }, style, { fontFamily, fontWeight: 'normal' }]}
      {...rest}
    />
  );
}
