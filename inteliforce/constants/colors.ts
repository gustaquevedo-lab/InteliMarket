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

  // Pro Max Semantics & Elevados
  accentCyan: '#0284c7',
  accentEmerald: '#059669',
  accentAmber: '#d97706',
  accentCrimson: '#dc2626',
  cardElevated: '#f1f5f9',
  surfaceHighlight: 'rgba(37, 99, 235, 0.08)',
  badgeBg: '#f1f5f9',

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

  background: palette.surfaceDark,            // #0f172a
  card: palette.surfaceContainerDark,         // #1e293b
  cardLow: palette.surfaceContainerLowDark,   // #131f37
  cardHigh: palette.surfaceContainerHighDark, // #25354e
  cardHighest: palette.surfaceContainerHighestDark,

  text: palette.onSurfaceDark,                // #f8fafc
  textSecondary: palette.onSurfaceVariantDark,// #94a3b8
  textMuted: '#64748b',
  textInverse: palette.surfaceDark,

  border: palette.outlineDark,                // #334155
  borderLight: '#23324a',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',

  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  info: '#38bdf8',
  infoLight: 'rgba(56, 189, 248, 0.15)',

  // Pro Max Semantics & Elevados
  accentCyan: '#38bdf8',
  accentEmerald: '#10b981',
  accentAmber: '#f59e0b',
  accentCrimson: '#ef4444',
  cardElevated: '#232e42',
  surfaceHighlight: 'rgba(56, 189, 248, 0.12)',
  badgeBg: 'rgba(255, 255, 255, 0.08)',

  offline: '#a8a29e',
  offlineBg: '#422006',
  offlineText: '#fde047',
};

// Exportación por defecto compatible
export const colors = lightTheme;
export type ThemeColors = typeof lightTheme | typeof darkTheme;

