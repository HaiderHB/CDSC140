import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#E9680C',
      light: '#FF8534',
      dark: '#C45400'
    },
    secondary: {
      main: '#444444',
      light: '#666666',
      dark: '#333333'
    },
    background: {
      default: '#151515',
      paper: '#252525'
    },
    text: {
      primary: '#f8f8f8',
      secondary: '#d0d0d0'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700
    },
    h2: {
      fontWeight: 600
    },
    button: {
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          padding: '10px 20px',
          backgroundImage: 'linear-gradient(to right, #C45400, #E9680C)',
          boxShadow: '0 4px 14px rgba(233, 104, 12, 0.4)',
          '&:hover': {
            backgroundImage: 'linear-gradient(to right, #B34800, #D05800)',
            boxShadow: '0 6px 20px rgba(233, 104, 12, 0.6)'
          }
        },
        contained: {
          backdropFilter: 'blur(4px)'
        },
        containedSecondary: {
          backgroundImage: 'linear-gradient(to right, #333333, #444444)',
          boxShadow: '0 4px 14px rgba(68, 68, 68, 0.4)',
          '&:hover': {
            backgroundImage: 'linear-gradient(to right, #222222, #333333)',
            boxShadow: '0 6px 20px rgba(68, 68, 68, 0.6)'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage:
            'linear-gradient(to bottom right, rgba(37, 37, 37, 0.8), rgba(21, 21, 21, 0.9))',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)'
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.3)'
            },
            '&.Mui-focused fieldset': {
              borderColor: '#E9680C'
            },
            backgroundColor: 'rgba(21, 21, 21, 0.6)',
            backdropFilter: 'blur(4px)'
          }
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          background: 'linear-gradient(to right, #E9680C, #FF8534)',
          height: 3
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.6)',
          '&.Mui-selected': {
            color: '#f8fafc'
          }
        }
      }
    }
  }
})

export default theme
