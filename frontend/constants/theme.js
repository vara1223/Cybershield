// ─── CyberShield Design Tokens ───────────────────────────────────────────────
//
//  Primary palette is DARK-FIRST. The dark theme is the "native" look of a
//  professional cybersecurity product. Light mode is a clean secondary option.
//
//  Cyber palette reference:
//   #00D4FF  — electric cyan   (primary action / active states)
//   #4361EE  — indigo blue     (secondary / authority)
//   #00C48C  — secure green    (SAFE verdict)
//   #FF4D4F  — threat red      (DANGEROUS verdict)
//   #FFB020  — amber           (SUSPICIOUS verdict)
//   #070B14  — deep navy bg    (dark background)
//   #0D1421  — dark card       (elevated surfaces)

export const Colors = {
  // ── Dark (primary/default) ─────────────────────────────────────────────────
  dark: {
    background:   '#070B14',
    card:         '#0D1421',
    surface:      '#111827',
    border:       '#1E2D45',
    borderActive: '#3B82F6',
    text:         '#E8EEFF',
    textSecondary:'#8899BB',
    textMuted:    '#4A5568',
    primary:      '#3B82F6',
    secondary:    '#2563EB',
    accent:       '#60A5FA',
    tabBar:       '#0A0F1E',
    tabBarBorder: '#1E2D45',
    inputBg:      '#0D1421',
    scanLineBg:   'rgba(59,130,246,0.03)',

    // Cyber-specific
    cyan:         '#60A5FA',
    cyanDim:      '#3B82F630',
    cyanBorder:   '#3B82F622',
    green:        '#00C48C',
    greenDim:     '#00C48C22',
    red:          '#FF4D4F',
    redDim:       '#FF4D4F22',
    amber:        '#FFB020',
    amberDim:     '#FFB02022',
    indigo:       '#6366F1',
    indigoDim:    '#6366F130',
    purple:       '#8B5CF6',
    pink:         '#FF4D4F',
  },

  // ── Light ──────────────────────────────────────────────────────────────────
  light: {
    background:   '#F0F6FF',
    card:         '#FFFFFF',
    surface:      '#EFF6FF',
    border:       '#BFDBFE',
    borderActive: '#2563EB',
    text:         '#1E3A5F',
    textSecondary:'#475569',
    textMuted:    '#93C5FD',
    primary:      '#2563EB',
    secondary:    '#1D4ED8',
    accent:       '#3B82F6',
    tabBar:       '#FFFFFF',
    tabBarBorder: '#BFDBFE',
    inputBg:      '#EFF6FF',
    scanLineBg:   'rgba(37,99,235,0.04)',

    // Cyber-specific
    cyan:         '#3B82F6',
    cyanDim:      '#3B82F618',
    cyanBorder:   '#3B82F630',
    green:        '#059669',
    greenDim:     '#05966918',
    red:          '#DC2626',
    redDim:       '#DC262618',
    amber:        '#D97706',
    amberDim:     '#D9770618',
    indigo:       '#4F46E5',
    indigoDim:    '#4F46E520',
    purple:       '#8B5CF6',
    pink:         '#EF4444',
  },

  // ── Verdict colors (shared) ────────────────────────────────────────────────
  verdict: {
    SAFE:       '#00C48C',
    SUSPICIOUS: '#FFB020',
    MODERATE:   '#FFB020',
    DANGEROUS:  '#FF4D4F',
    DANGER:     '#FF4D4F',
  },
  verdictBg: {
    SAFE:       '#ECFDF5',
    SUSPICIOUS: '#FFFBEB',
    MODERATE:   '#FFFBEB',
    DANGEROUS:  '#FFF1F2',
    DANGER:     '#FFF1F2',
  },
  verdictBgDark: {
    SAFE:       '#00C48C14',
    SUSPICIOUS: '#FFB02014',
    MODERATE:   '#FFB02014',
    DANGEROUS:  '#FF4D4F14',
    DANGER:     '#FF4D4F14',
  },
  verdictBorder: {
    SAFE:       '#00C48C35',
    SUSPICIOUS: '#FFB02035',
    MODERATE:   '#FFB02035',
    DANGEROUS:  '#FF4D4F35',
    DANGER:     '#FF4D4F35',
  },

  // ── Stat palette ──────────────────────────────────────────────────────────
  stat: {
    blue:   { bg: '#EEF2FF', text: '#4361EE', darkBg: '#4361EE14', darkText: '#818CF8' },
    red:    { bg: '#FFF1F2', text: '#FF4D4F', darkBg: '#FF4D4F14', darkText: '#FF7875' },
    green:  { bg: '#ECFDF5', text: '#00C48C', darkBg: '#00C48C14', darkText: '#34D399' },
    amber:  { bg: '#FFFBEB', text: '#FFB020', darkBg: '#FFB02014', darkText: '#FBBF24' },
    cyan:   { bg: '#ECFEFF', text: '#0EA5E9', darkBg: '#00D4FF14', darkText: '#00D4FF' },
    purple: { bg: '#F5F3FF', text: '#8B5CF6', darkBg: '#8B5CF614', darkText: '#A78BFA' },
  },
};

export const Typography = {
  mono:        'System',
  monoBold:    'System',
  body:        'System',
  bodyMedium:  'System',
  bodySemiBold:'System',
  bodyBold:    'System',
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const Radius = {
  sm:   4,
  md:   10,
  lg:   14,
  xl:   20,
  xxl:  28,
  pill: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  glow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  glowGreen: {
    shadowColor: '#00C48C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  glowRed: {
    shadowColor: '#FF4D4F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
};
