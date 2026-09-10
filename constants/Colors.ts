import { VisualSystem } from './VisualSystem';

/**
 * Legacy Colors shape used by the Expo template components. Values now resolve
 * from VisualSystem. Both `light` and `dark` return the same light palette —
 * the app ships a single theme, and returning a dark set here would mismatch
 * every screen.
 */
const palette = {
  text: VisualSystem.colors.textPrimary,
  textSecondary: VisualSystem.colors.textSecondary,
  background: VisualSystem.colors.bgBase,
  surface: VisualSystem.colors.bgMid,
  surfaceAccent: VisualSystem.colors.bgDeep,
  tint: VisualSystem.colors.gold,
  tabIconDefault: VisualSystem.colors.textTertiary,
  tabIconSelected: VisualSystem.colors.goldText,
  primary: VisualSystem.colors.navy,
  accent: VisualSystem.colors.gold,
  glow: VisualSystem.colors.goldBright,
  glass: VisualSystem.colors.glassFill,
  glassBorder: VisualSystem.colors.borderGold,
};

export default {
  light: palette,
  dark: palette,
};
