import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import type { TextStyle } from 'react-native';

import type { typeScale } from './tokens';

// Steady's two typefaces: Fraunces, a soft serif, for titles, headings and the big numbers;
// Inter for everything else. Each weight is its own file and family name, so a style's weight
// picks the file; the weight itself is then left at normal, or browsers and Android would
// thicken an already-bold file.

/** Only these files ship: the deep imports keep the other weights out of the web bundle. */
export const FONT_FILES = { Fraunces_500Medium, Fraunces_600SemiBold, Inter_400Regular, Inter_600SemiBold };

export const fonts = {
  title: 'Fraunces_600SemiBold',
  /** The big streak number. */
  number: 'Fraunces_500Medium',
  text: 'Inter_400Regular',
  textStrong: 'Inter_600SemiBold',
} as const;

const STRONG = new Set(['600', '700', '800', '900', 'bold']);

export function fontFamilyFor(variant: keyof typeof typeScale, weight: TextStyle['fontWeight']): string {
  if (variant === 'display' || variant === 'title' || variant === 'heading') return fonts.title;
  return weight !== undefined && STRONG.has(String(weight)) ? fonts.textStrong : fonts.text;
}
