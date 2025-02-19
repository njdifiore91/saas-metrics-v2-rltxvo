import { createTheme, ThemeOptions, Theme } from '@mui/material'; // @mui/material v5.0.0

// Augment the Theme interface to include custom properties
declare module '@mui/material/styles' {
  interface Palette {
    data: {
      positive: string;
      negative: string;
      neutral: string;
      highlight: string;
    };
  }
  interface PaletteOptions {
    data?: {
      positive?: string;
      negative?: string;
      neutral?: string;
      highlight?: string;
    };
  }
  interface PaletteColor {
    hover?: string;
  }
  interface SimplePaletteColorOptions {
    hover?: string;
  }
  interface TypographyVariants {
    metric: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    metric?: React.CSSProperties;
  }
}

// Update Typography component to include custom variant
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    metric: true;
  }
}

const themeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: '#151e2d',
      light: '#46608C',
      dark: '#0D1420',
      contrastText: '#FFFFFF',
      hover: '#1a2436',
    },
    secondary: {
      main: '#46608C',
      light: '#6B82AC',
      dark: '#2D4366',
      contrastText: '#FFFFFF',
      hover: '#526d99',
    },
    success: {
      main: '#168947',
      light: '#1EAB59',
      dark: '#0E6735',
      contrastText: '#FFFFFF',
      hover: '#1a9d50',
    },
    background: {
      default: '#DBEAAC',
      paper: '#FFFFFF',
      contrast: '#F5F5F5',
    },
    text: {
      primary: '#0D3330',
      secondary: '#46608C',
      disabled: 'rgba(13, 51, 48, 0.38)',
      hint: 'rgba(13, 51, 48, 0.38)',
    },
    data: {
      positive: '#168947',
      negative: '#D32F2F',
      neutral: '#46608C',
      highlight: '#FFC107',
    },
  },
  typography: {
    fontFamily: 'Inter, -apple-system, sans-serif',
    fontFamilyMetrics: 'Inter Mono, monospace',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.2,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      lineHeight: 1.2,
      letterSpacing: '0em',
    },
    body1: {
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.43,
      letterSpacing: '0.01071em',
    },
    metric: {
      fontFamily: 'Inter Mono, monospace',
      fontWeight: 500,
      fontSize: '1.25rem',
      lineHeight: 1.2,
    },
  },
  spacing: (factor: number) => `${8 * factor}px`,
  breakpoints: {
    values: {
      xs: 320,
      sm: 768,
      md: 1024,
      lg: 1440,
      xl: 1920,
    },
  },
  shape: {
    borderRadius: 4,
  },
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: 'none',
        },
      },
    },
    MuiFocusVisible: {
      styleOverrides: {
        root: {
          outline: '2px solid #46608C',
          outlineOffset: 2,
        },
      },
    },
  },
};

const theme = createTheme(themeOptions);

export default theme;