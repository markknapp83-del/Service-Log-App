// Healthcare domain types following TypeScript documentation patterns

// Basic types
export type UserId = string;
export type PatientId = string;
export type ServiceId = string;
export type UserRole = 'admin' | 'candidate';
export type ISODateString = string;

// User authentication and management types
export interface User {
  readonly id: UserId;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// API Response types with discriminated unions
export type ApiResponse<T> = 
  | { success: true; data: T; timestamp: ISODateString }
  | { success: false; error: ErrorDetails; timestamp: ISODateString };

export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: Omit<User, 'passwordHash'>;
  expiresAt: ISODateString;
}

export interface JWTPayload {
  userId: UserId;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: UserId;
  tokenVersion: number;
  iat: number;
  exp: number;
}

// Form validation types
export type ValidationResult = 
  | { valid: true; value: string }
  | { valid: false; errors: string[] };

// User creation types
export type UserCreateRequest = Omit<User, 'id' | 'passwordHash' | 'createdAt' | 'updatedAt' | 'lastLoginAt'> & {
  password: string;
};

export type UserUpdateRequest = Partial<Pick<User, 'firstName' | 'lastName' | 'email' | 'isActive'>>;

// Database types
export interface DatabaseUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  first_name: string;
  last_name: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// Request extensions
declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'passwordHash'>;
    }
  }
}

// Environment configuration
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  DB_PATH: string;
  CORS_ORIGIN: string[];
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvironmentConfig {}
  }
}

// Repository patterns
export interface Repository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findAll(filters?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: K, data: Partial<T>): Promise<T>;
  delete(id: K): Promise<void>;
}

// Service layer types
export interface ServiceDependencies {
  userRepo: Repository<User, UserId>;
  logger: Logger;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// Error handling types
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };