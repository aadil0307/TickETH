/**
 * TickETH Design System v2.0
 * Premium dark theme with glass-morphism, vibrant gradients & refined spacing
 */

export const Colors = {
  // Primary brand — Electric indigo
  primary: '#7B6EF6',
  primaryLight: '#9D93FF',
  primaryDark: '#5B4FD6',
  primaryMuted: 'rgba(123, 110, 246, 0.12)',

  // Accent — Cyan glow
  accent: '#00E5FF',
  accentLight: '#67F0FF',
  accentMuted: 'rgba(0, 229, 255, 0.12)',

  // Success / Error / Warning
  success: '#00D68F',
  successLight: '#33E5AB',
  successMuted: 'rgba(0, 214, 143, 0.12)',
  error: '#FF4D6A',
  errorLight: '#FF7A90',
  errorMuted: 'rgba(255, 77, 106, 0.12)',
  warning: '#FFB800',
  warningLight: '#FFCB45',
  warningMuted: 'rgba(255, 184, 0, 0.12)',

  // Backgrounds (premium dark)
  background: '#08080F',
  surface: '#12121F',
  surfaceLight: '#1C1C30',
  surfaceHighlight: '#262645',

  // Glass surfaces
  glass: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassLight: 'rgba(255, 255, 255, 0.07)',

  // Text
  textPrimary: '#F5F5FF',
  textSecondary: '#9B9BB8',
  textMuted: '#5E5E78',
  textInverse: '#08080F',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.10)',
  borderActive: 'rgba(123, 110, 246, 0.4)',

  // Overlays
  overlay: 'rgba(8, 8, 15, 0.75)',
  overlayLight: 'rgba(8, 8, 15, 0.45)',

  // Gradients (use with LinearGradient)
  gradientPrimary: ['#7B6EF6', '#5B4FD6'] as const,
  gradientAccent: ['#00E5FF', '#7B6EF6'] as const,
  gradientDark: ['#12121F', '#08080F'] as const,
  gradientCard: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] as const,
  gradientHero: ['#7B6EF6', '#00E5FF'] as const,
  gradientSunset: ['#FF4D6A', '#FFB800'] as const,

  // Ticket status colors
  ticketActive: '#00D68F',
  ticketUsed: '#5E5E78',
  ticketTransferred: '#FFB800',
  ticketListed: '#00E5FF',
} as const;

export const Typography = {
  sizes: {
    '2xs': 10,
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    hero: 42,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  families: {
    sans: undefined, // Uses system default
    mono: 'monospace' as const,
  },
  lineHeights: {
    tight: 1.1,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

export const Spacing = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  glow: {
    shadowColor: '#7B6EF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  glowAccent: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const Layout = {
  screenPadding: Spacing.xl,
  cardPadding: Spacing.lg,
  maxContentWidth: 480,
  tabBarHeight: 72,
  headerHeight: 56,
} as const;
