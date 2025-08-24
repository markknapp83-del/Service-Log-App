// Authentication hook following React 18 documentation patterns
import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthContextType, LoginRequest, LoginResponse, ApiResponse } from '@/types';
import { apiService } from '@/services/apiService';

// Authentication state
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
}

// Authentication actions
type AuthAction =
  | { type: 'AUTH_LOADING'; payload: boolean }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_ERROR' }
  | { type: 'AUTH_INITIALIZED' };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isInitialized: false,
};

// Auth reducer following documented patterns
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isInitialized: true,
      };
      
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isInitialized: true,
      };
      
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isInitialized: true,
      };
      
    case 'AUTH_INITIALIZED':
      return {
        ...state,
        isInitialized: true,
        isLoading: false,
      };
      
    default:
      return state;
  }
}

// Auth context
const AuthContext = createContext<AuthContextType | null>(null);

// Token storage utilities
const TOKEN_STORAGE_KEY = 'healthcare_portal_token';
const REFRESH_TOKEN_STORAGE_KEY = 'healthcare_portal_refresh_token';

const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

const getStoredRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
};

const setTokens = (token: string, refreshToken: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
};

const removeTokens = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
};

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = getStoredToken();
      
      if (!token) {
        dispatch({ type: 'AUTH_INITIALIZED' });
        return;
      }

      try {
        // Verify token with backend
        const response = await apiService.get<{ user: User }>('/auth/verify');
        
        if (response.success) {
          dispatch({ 
            type: 'AUTH_SUCCESS', 
            payload: { user: response.data.user, token } 
          });
        } else {
          // Token is invalid, remove it
          removeTokens();
          dispatch({ type: 'AUTH_ERROR' });
        }
      } catch (error) {
        // Token verification failed, remove it
        removeTokens();
        dispatch({ type: 'AUTH_ERROR' });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    dispatch({ type: 'AUTH_LOADING', payload: true });

    try {
      const response = await apiService.post<LoginRequest, LoginResponse>('/auth/login', credentials);
      
      if (response.success) {
        const { token, refreshToken, user } = response.data;
        
        // Store tokens
        setTokens(token, refreshToken);
        
        // Update state
        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
      } else {
        dispatch({ type: 'AUTH_ERROR' });
      }

      return response;
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      // Call logout endpoint to invalidate token server-side
      await apiService.post('/auth/logout', {});
    } catch (error) {
      // Even if logout fails server-side, we still clear local state
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear tokens and state
      removeTokens();
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Refresh token function
  const refreshToken = async (): Promise<boolean> => {
    const refreshTokenValue = getStoredRefreshToken();
    
    if (!refreshTokenValue) {
      dispatch({ type: 'AUTH_LOGOUT' });
      return false;
    }

    try {
      const response = await apiService.post<{ refreshToken: string }, { token: string; expiresAt: string }>(
        '/auth/refresh',
        { refreshToken: refreshTokenValue }
      );

      if (response.success && state.user) {
        const { token } = response.data;
        
        // Update stored token
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        
        // Update state
        dispatch({ 
          type: 'AUTH_SUCCESS', 
          payload: { user: state.user, token } 
        });
        
        return true;
      } else {
        // Refresh failed, logout user
        removeTokens();
        dispatch({ type: 'AUTH_LOGOUT' });
        return false;
      }
    } catch (error) {
      // Refresh failed, logout user
      removeTokens();
      dispatch({ type: 'AUTH_LOGOUT' });
      return false;
    }
  };

  const contextValue: AuthContextType = {
    user: state.user,
    token: state.token,
    login,
    logout,
    refreshToken,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user && !!state.token,
  };

  // Don't render children until auth is initialized
  if (!state.isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}