// Frontend types following TypeScript documentation patterns

// Basic types
export type UserId = string;
export type UserRole = 'admin' | 'candidate';
export type ISODateString = string;

// User types
export interface User {
  readonly id: UserId;
  username: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  expiresAt: ISODateString;
}

export interface AuthUser extends User {
  // Extended user type for authenticated context
}

// API Response types
export type ApiResponse<T> = 
  | { success: true; data: T; timestamp: ISODateString }
  | { success: false; error: ErrorDetails; timestamp: ISODateString };

export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Form validation types
export type ValidationResult = 
  | { valid: true; value: string }
  | { valid: false; errors: string[] };

// Auth context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<ApiResponse<LoginResponse>>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Route protection types
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
}

// Form types following React Hook Form patterns
export interface LoginFormData {
  email: string;
  password: string;
}

// API service types
export interface ApiServiceConfig {
  baseURL: string;
  timeout: number;
}

export interface ApiClient {
  get<T>(endpoint: string): Promise<ApiResponse<T>>;
  post<T, U>(endpoint: string, data: T): Promise<ApiResponse<U>>;
  put<T, U>(endpoint: string, data: T): Promise<ApiResponse<U>>;
  delete(endpoint: string): Promise<ApiResponse<void>>;
}

// Component prop types
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

// Error boundary types
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}