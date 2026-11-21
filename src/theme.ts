import { DynamicColorIOS, PlatformColor } from 'react-native';

// iOS resolves these per light/dark mode natively, so nothing re-renders on a theme change.
const dyn = (light: string, dark: string) => DynamicColorIOS({ light, dark });

export const colors = {
  bg: dyn('#FFFFFF', '#000000'),
  surface: dyn('#F7F7F9', '#1C1C1E'), // cards, grids, calendar
  group: dyn('#F7F7F9', '#141416'), // settings rows
  label: PlatformColor('label'),
  secondary: PlatformColor('secondaryLabel'),
  tertiary: PlatformColor('tertiaryLabel'),
  separator: PlatformColor('separator'),
  fill: PlatformColor('tertiarySystemFill'),
  red: PlatformColor('systemRed'),
  onLabel: dyn('#FFFFFF', '#000000'), // text/icons on a label-colored button
};

// Heatmap/bar steps: system red at increasing strength; level 0 is an empty fill.
const heatSteps = [0.28, 0.5, 0.75, 1].map((a) => dyn(`rgba(255,59,48,${a})`, `rgba(255,69,58,${a})`));
export const heat = (level: number) => (level <= 0 ? colors.fill : heatSteps[Math.min(level, 4) - 1]);

export const rounded = { fontFamily: 'ui-rounded' } as const; // SF Pro Rounded, used for numbers
