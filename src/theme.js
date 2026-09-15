export const colors = {
  primary: "#4338CA",
  primaryLight: "#E0E7FF",
  primaryDark: "#3730A3",

  accentTeal: "#0D9488",
  accentTealLight: "#CCFBF1",
  accentPurple: "#7C3AED",
  accentPurpleLight: "#EDE9FE",
  accentOrange: "#EA580C",
  accentOrangeLight: "#FFEDD5",

  background: "#F5F6FA",
  surface: "#FFFFFF",

  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",

  border: "#E5E7EB",

  success: "#059669",
  successLight: "#D1FAE5",
  successDark: "#047857",

  warning: "#D97706",
  warningLight: "#FEF3C7",
  warningDark: "#92400E",

  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  dangerDark: "#991B1B",

  neutral: "#6B7280",
  neutralLight: "#F3F4F6",
  neutralDark: "#374151",
};

export const statusColors = {
  created: { bg: colors.neutralLight, text: colors.neutralDark },
  assigned: { bg: colors.warningLight, text: colors.warningDark },
  started: { bg: colors.primaryLight, text: colors.primaryDark },
  closed: { bg: colors.successLight, text: colors.successDark },
  cancelled: { bg: colors.dangerLight, text: colors.dangerDark },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
};

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 22,
  xxxl: 24,
};

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
};