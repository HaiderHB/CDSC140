export interface AuthState {
  isAuthenticated: boolean
  userId?: string
  accessToken?: string
}

class AuthService {
  private static instance: AuthService
  private authState: AuthState = {
    isAuthenticated: false
  }

  private constructor() {
    // Load saved auth state on initialization
    const savedState = localStorage.getItem('authState')
    if (savedState) {
      try {
        this.authState = JSON.parse(savedState)
      } catch (error) {
        console.error('Failed to parse saved auth state:', error)
      }
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  public getAuthState(): AuthState {
    return { ...this.authState }
  }

  public setAuthState(state: Partial<AuthState>) {
    this.authState = { ...this.authState, ...state }
    // Save auth state to local storage
    localStorage.setItem('authState', JSON.stringify(this.authState))
  }

  public async initiateLogin() {
    try {
      // @ts-ignore
      await window.api.openExternal('https://interviewspeaker.co/sign-in?fromApp=true')
    } catch (error) {
      console.error('Failed to open login URL:', error)
    }
  }

  public handleAuthCallback(url: string) {
    console.log('handleAuthCallback2', url)
    const urlObj = new URL(url)
    const params = new URLSearchParams(urlObj.search)
    console.log('params', params)

    const accessToken = params.get('access_token')
    const userId = params.get('user_id')

    if (accessToken && userId) {
      this.setAuthState({
        isAuthenticated: true,
        accessToken,
        userId
      })
      console.log('authState set', this.authState)
      return true
    }
    console.log('no access token or user id')
    return false
  }

  public logout() {
    this.authState = {
      isAuthenticated: false
    }
    // Clear auth state from local storage
    localStorage.removeItem('authState')
  }
}

export const authService = AuthService.getInstance()
