// constants/colors.ts
// Direct mapping of Stitch "Field Force High-Utility" (Light) & "Field Force Tactical Dark" (Dark)

export const palette = {
  // Brand Tactical Emerald & Greens
  primaryLight: '#006b2c',       // High-Utility primary
  primaryLightActive: '#00873a',
  primaryLightFixed: '#7ffc97',
  onPrimaryLightFixed: '#005320',

  primaryDark: '#4be277',        // Tactical Dark primary
  primaryDarkActive: '#22c55e',
  primaryDarkContainer: '#004b1e',

  // Corporate InteliMarket Cobalts & Navies
  navy900: '#0f1f3d',
  navy800: '#1e3a5f',
  cobalt600: '#1e40af',
  tertiaryLight: '#3452c1',
  tertiaryDark: '#aec8f5',

  // Semantics
  errorLight: '#ba1a1a',
  errorDark: '#ffb4ab',
  warningLight: '#d97706',
  warningDark: '#fbbf24',
  offlineSepia: '#78716c',

  // Surfaces Light (Field Force High-Utility)
  surfaceLight: '#faf8ff',
  surfaceContainerLowestLight: '#ffffff',
  surfaceContainerLowLight: '#f2f3ff',
  surfaceContainerLight: '#eaedff',
  surfaceContainerHighLight: '#e2e7ff',
  surfaceContainerHighestLight: '#dae2fd',
  onSurfaceLight: '#131b2e',
  onSurfaceVariantLight: '#3e4a3d',
  outlineLight: '#e2e7ff',
  outlineBorderLight: '#c8d7fe',

  // Surfaces Dark (InteliMarket Navy Dark)
  surfaceDark: '#0f172a',                  // Intelimarket Signature Navy Blue
  surfaceContainerLowestDark: '#0b1322',
  surfaceContainerLowDark: '#131f37',
  surfaceContainerDark: '#1e293b',         // Intelimarket Card Slate Navy
  surfaceContainerHighDark: '#25354e',
  surfaceContainerHighestDark: '#334155',  // Elevated Slate
  onSurfaceDark: '#f8fafc',                // Pure crisp white text
  onSurfaceVariantDark: '#94a3b8',         // Slate 400 crisp secondary
  outlineDark: '#334155',                  // Slate 700 border
  outlineBorderDark: '#1e293b',            // Card border
};

// Modo Claro: Stitch "Field Force High-Utility"
export const lightTheme = {
  mode: 'light' as const,
  primary: palette.primaryLight,              // #006b2c
  primaryLight: palette.primaryLightActive,   // #00873a
  primaryDark: palette.navy900,               // #0f1f3d
  primaryActive: palette.primaryLightActive,
  primaryFixed: palette.primaryLightFixed,
  onPrimaryFixed: palette.onPrimaryLightFixed,

  secondary: palette.navy900,
  tertiary: palette.tertiaryLight,

  background: palette.surfaceLight,           // #faf8ff
  card: palette.surfaceContainerLowestLight,  // #ffffff
  cardLow: palette.surfaceContainerLowLight,  // #f2f3ff
  cardHigh: palette.surfaceContainerHighLight,// #e2e7ff
  cardHighest: palette.surfaceContainerHighestLight,

  text: palette.onSurfaceLight,               // #131b2e
  textSecondary: palette.onSurfaceVariantLight,
  textMuted: '#6e7b6c',
  textInverse: '#ffffff',

  border: palette.outlineBorderLight,         // #c8d7fe
  borderLight: palette.outlineLight,          // #e2e7ff
  borderSubtle: palette.outlineLight,

  success: palette.primaryLight,
  successLight: '#dcfce7',
  warning: palette.warningLight,
  warningLight: '#fef3c7',
  danger: palette.errorLight,
  dangerLight: '#ffdad6',
  info: palette.cobalt600,
  infoLight: '#dbeafe',

  offline: palette.offlineSepia,
  offlineBg: '#fef08a',
  offlineText: '#854d0e',
};

// Modo Oscuro: InteliMarket Navy Dark
export const darkTheme = {
  mode: 'dark' as const,
  primary: '#01A751',                          // Verde Oficial Inteliforce
  primaryLight: '#22c55e',                     // Verde Esmeralda Vibrante
  primaryDark: '#0f172a',                      // Azul Marino Intelimarket
  primaryActive: '#16a34a',
  primaryFixed: '#7ffc97',
  onPrimaryFixed: '#002109',

  secondary: '#38bdf8',                        // Azul Cielo Intelimarket
  tertiary: '#60a5fa',                         // Azul Cobalto Suave

  background: palette.surfaceDark,            // #0a0f1a
  card: palette.surfaceContainerDark,         // #192029
  cardLow: palette.surfaceContainerLowDark,   // #151c25
  cardHigh: palette.surfaceContainerHighDark, // #232a34
  cardHighest: palette.surfaceContainerHighestDark,

  text: palette.onSurfaceDark,                // #f9fafb
  textSecondary: palette.onSurfaceVariantDark,// #9ca3af
  textMuted: '#64748b',
  textInverse: palette.surfaceDark,

  border: palette.outlineDark,                // #374151
  borderLight: palette.outlineBorderDark,
  borderSubtle: palette.outlineBorderDark,

  success: palette.primaryDark,
  successLight: 'rgba(75, 226, 119, 0.15)',
  warning: palette.warningDark,
  warningLight: 'rgba(251, 191, 36, 0.15)',
  danger: palette.errorDark,
  dangerLight: 'rgba(255, 180, 171, 0.15)',
  info: palette.tertiaryDark,
  infoLight: 'rgba(174, 200, 245, 0.15)',

  offline: '#a8a29e',
  offlineBg: '#422006',
  offlineText: '#fde047',
};

// Exportación por defecto compatible
export const colors = lightTheme;
export type ThemeColors = typeof lightTheme | typeof darkTheme;
