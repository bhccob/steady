import { useEffect, useState } from 'react';
import { Animated, View, type StyleProp, type TextStyle } from 'react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { AppText } from './Text';

interface RollingNumberProps {
  value: number;
  style?: StyleProp<TextStyle>;
  maxFontSizeMultiplier?: number;
}

/** A number that rolls up to its new value when it grows. It changes in place when it shrinks, or under Reduce Motion. */
export function RollingNumber({ value, style, maxFontSizeMultiplier }: RollingNumberProps) {
  const reduced = useReducedMotion();
  const [prev, setPrev] = useState(value);
  const [roll, setRoll] = useState<{ from: number; to: number } | null>(null);
  const [height, setHeight] = useState(0);
  const [y] = useState(() => new Animated.Value(0));

  // A new value starts a roll during render, so the old number never flashes in its place.
  if (value !== prev) {
    setPrev(value);
    setRoll(value > prev && !reduced && height > 0 ? { from: prev, to: value } : null);
  }

  useEffect(() => {
    if (!roll) return;
    y.setValue(0);
    Animated.spring(y, { toValue: 1, damping: 15, stiffness: 170, mass: 0.9, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setRoll(null);
    });
  }, [roll, y]);

  const text = (n: number) => (
    <AppText style={style} maxFontSizeMultiplier={maxFontSizeMultiplier}>
      {n}
    </AppText>
  );

  if (!roll) return <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>{text(value)}</View>;
  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }] }}>
        {text(roll.from)}
        {text(roll.to)}
      </Animated.View>
    </View>
  );
}
