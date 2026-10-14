import { createTheme } from '@mui/material/styles'

// Elderly design tokens — source of truth is :root in resources/index.html.
export const tokens = {
  bg: '#F5EFE6',
  paper: '#FFFCF7',
  white: '#fff',
  ink: '#1D1A16',
  ink2: '#4A443C',
  muted: '#7A7166',
  line: '#E6DCCD',
  accent: '#1E6B57',
  accentSoft: '#DDEEE6',
  sos: '#C2362B',
  sosSoft: '#FBE3DF',
  amber: '#9A5F0E',
  amberSoft: '#FBEFD8',
  blue: '#2B5AA3',
  blueSoft: '#E2EAF7',
  plum: '#7A3E78',
  plumSoft: '#F2E3F1',
  radius: 18,
  shadow: '0 1px 2px rgba(40,30,20,.05),0 8px 24px rgba(40,30,20,.06)',
} as const

const headingFont = "'Fraunces', Georgia, serif"

export const theme = createTheme({
  palette: {
    primary: { main: tokens.accent, contrastText: tokens.white },
    error: { main: tokens.sos },
    warning: { main: tokens.amber },
    info: { main: tokens.blue },
    background: { default: tokens.bg, paper: tokens.paper },
    text: { primary: tokens.ink, secondary: tokens.muted },
    divider: tokens.line,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif",
    h1: { fontFamily: headingFont, fontWeight: 650, letterSpacing: '-.01em' },
    h2: { fontFamily: headingFont, fontWeight: 650, letterSpacing: '-.01em' },
    h3: { fontFamily: headingFont, fontWeight: 650, letterSpacing: '-.01em' },
    h4: { fontFamily: headingFont, fontWeight: 650, letterSpacing: '-.01em' },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, padding: '9px 14px' },
        outlined: {
          borderColor: tokens.line,
          background: tokens.white,
          color: tokens.ink,
          '&:hover': { borderColor: tokens.ink2, background: tokens.white },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: tokens.radius },
        outlined: { borderColor: tokens.line, boxShadow: tokens.shadow },
      },
    },
  },
})
