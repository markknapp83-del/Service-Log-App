// API service following documented patterns
import { ApiResponse, ApiClient, ApiServiceConfig } from '@/types';

class ApiService implements ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor(config: ApiServiceConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Get token for authenticated requests
    const token = localStorage.getItem('healthcare_portal_token');
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (response.ok) {
        return data as ApiResponse<T>;
      } else {
        // Handle HTTP errors
        if (response.status === 401) {
          // Token expired or invalid, attempt refresh
          const refreshed = await this.attemptTokenRefresh();
          
          if (refreshed) {
            // Retry the original request with new token
            const newToken = localStorage.getItem('healthcare_portal_token');
            if (newToken) {
              const retryConfig = {
                ...config,
                headers: {
                  ...config.headers,
                  Authorization: `Bearer ${newToken}`,
                },
              };
              
              const retryResponse = await fetch(url, retryConfig);
              const retryData = await retryResponse.json();
              
              if (retryResponse.ok) {
                return retryData as ApiResponse<T>;
              }
            }
          }
        }
        
        return data as ApiResponse<T>;
      }
    } catch (error) {
      // Handle network errors
      console.error('API request failed:', error);
      
      const networkError: ApiResponse<T> = {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
        timestamp: new Date().toISOString(),
      };
      
      return networkError;
    }
  }

  private async attemptTokenRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem('healthcare_portal_refresh_token');
    
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data.token) {
          localStorage.setItem('healthcare_portal_token', data.data.token);
          return true;
        }
      }
      
      // Refresh failed, clear tokens
      localStorage.removeItem('healthcare_portal_token');
      localStorage.removeItem('healthcare_portal_refresh_token');
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      
      // Clear tokens on refresh failure
      localStorage.removeItem('healthcare_portal_token');
      localStorage.removeItem('healthcare_portal_refresh_token');
      
      return false;
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'GET',
    });
  }

  async post<T, U>(endpoint: string, data: T): Promise<ApiResponse<U>> {
    return this.makeRequest<U>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T, U>(endpoint: string, data: T): Promise<ApiResponse<U>> {
    return this.makeRequest<U>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(endpoint, {
      method: 'DELETE',
    });
  }
}

// Create API service instance
export const apiService = new ApiService({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000, // 10 seconds
});