export const Colors = {
  light: {
    background: '#F5F6FA',
    card: '#FFFFFF',
    surface: '#EEF0F8',
    border: '#E8EAF0',
    borderActive: '#00C896',
    text: '#1A1D2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    primary: '#4361EE',
    accent: '#00E5A0',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E8EAF0',
    inputBg: '#FFFFFF',
    scanLineBg: 'rgba(67,97,238,0.04)',
  },
  dark: {
    background: '#0D0F14',
    card: '#161920',
    surface: '#1E2230',
    border: '#252830',
    borderActive: '#00E5A0',
    text: '#F0F2F8',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    primary: '#4361EE',
    accent: '#00E5A0',
    tabBar: '#0D0F14',
    tabBarBorder: '#252830',
    inputBg: '#161920',
    scanLineBg: 'rgba(0,229,160,0.04)',
  },
  verdict: {
    SAFE: '#22C55E',
    SUSPICIOUS: '#F59E0B',
    MODERATE: '#F59E0B',
    DANGEROUS: '#EF4444',
    DANGER: '#EF4444',
  },
  verdictBg: {
    SAFE: '#F0FFF4',
    SUSPICIOUS: '#FFFBEB',
    MODERATE: '#FFFBEB',
    DANGEROUS: '#FEF2F2',
    DANGER: '#FEF2F2',
  },
  verdictBgDark: {
    SAFE: '#052E16',
    SUSPICIOUS: '#451A03',
    MODERATE: '#451A03',
    DANGEROUS: '#450A0A',
    DANGER: '#450A0A',
  },
  stat: {
    blue: { bg: '#EEF2FF', text: '#4361EE', darkBg: '#1E2A50', darkText: '#818CF8' },
    red:  { bg: '#FEF2F2', text: '#EF4444', darkBg: '#450A0A', darkText: '#F87171' },
    green:{ bg: '#F0FFF4', text: '#22C55E', darkBg: '#052E16', darkText: '#4ADE80' },
    purple:{ bg: '#F5F3FF', text: '#8B5CF6', darkBg: '#2E1065', darkText: '#A78BFA' },
  },
};

export const Typography = {
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
};
