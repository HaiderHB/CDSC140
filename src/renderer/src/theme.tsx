import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5'
    },
    secondary: {
      main: '#ec4899',
      light: '#f472b6',
      dark: '#db2777'
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b'
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1'
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
          backgroundImage: 'linear-gradient(to right, #4f46e5, #6366f1)',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          '&:hover': {
            backgroundImage: 'linear-gradient(to right, #4338ca, #4f46e5)',
            boxShadow: '0 6px 20px rgba(99, 102, 241, 0.6)'
          }
        },
        contained: {
          backdropFilter: 'blur(4px)'
        },
        containedSecondary: {
          backgroundImage: 'linear-gradient(to right, #db2777, #ec4899)',
          boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
          '&:hover': {
            backgroundImage: 'linear-gradient(to right, #be185d, #db2777)',
            boxShadow: '0 6px 20px rgba(236, 72, 153, 0.6)'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage:
            'linear-gradient(to bottom right, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.2)'
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
              borderColor: '#6366f1'
            },
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)'
          }
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          background: 'linear-gradient(to right, #6366f1, #ec4899)',
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
