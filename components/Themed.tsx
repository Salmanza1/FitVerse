/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */

import { Text as DefaultText, View as DefaultView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

import Colors from '@/constants/Colors';
import { Tokens } from '@/constants/Tokens';
import { useColorScheme } from './useColorScheme';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return <DefaultText style={[{ color, fontFamily: 'System' }, style]} {...otherProps} />;
}

export function SecondaryText(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'textSecondary');

  return <DefaultText style={[{ color, fontSize: 14, fontFamily: 'System' }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}

export function Card(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const glassColor = useThemeColor({ light: lightColor, dark: darkColor }, 'glass');
  const borderColor = useThemeColor({ light: lightColor, dark: darkColor }, 'glassBorder');

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 28 : 48}
      tint="dark"
      style={[
        {
          backgroundColor: glassColor,
          borderRadius: Tokens.radius.lg,
          padding: Tokens.spacing.xl,
          borderWidth: 1,
          borderColor: borderColor,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 6,
          ...({ boxShadow: '0 12px 32px rgba(0,0,0,0.18)' } as any),
        },
        style
      ]}
      {...otherProps as any}
    />
  );
}

export function GlowView(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const glowColor = useThemeColor({ light: lightColor, dark: darkColor }, 'glow');

  return (
    <DefaultView
      style={[
        {
          borderRadius: Tokens.radius.md,
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 18,
          elevation: 10,
          // Web compatibility
          ...({ boxShadow: `0 0 20px ${glowColor}` } as any),
        },
        style
      ]}
      {...otherProps}
    />
  );
}
