// Authentication service following service layer patterns
import { UserRepository } from '@/models/UserRepository';
import { JWTUtils } from '@/utils/jwt';
import { logger } from '@/utils/logger';
import { 
  LoginRequest, 
  LoginResponse, 
  User, 
  ApiResponse
} from '@/types/index';
import { AuthenticationError, ValidationError } from '@/utils/errors';
import { accountLockoutUtils } from '@/middleware/security';
import { HIPAALogger } from '@/utils/hipaa-compliance';
import bcrypt from 'bcryptjs';

// Result type that matches test expectations
type ServiceResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

export class AuthService {
  private jwtUtils: JWTUtils;
  private tokenBlacklist: Set<string> = new Set();

  constructor(private userRepository: UserRepository) {
    this.jwtUtils = new JWTUtils();
  }

  async login(loginData: LoginRequest, ipAddress?: string, userAgent?: string): Promise<ServiceResult<LoginResponse>> {
    const loginIdentifier = loginData.email; // Use email as identifier for lockout
    
    try {
      // Validate input
      this.validateLoginData(loginData);

      // Check if account is locked
      if (accountLockoutUtils.isLocked(loginIdentifier)) {
        const lockoutTime = accountLockoutUtils.getLockoutTime(loginIdentifier);
        HIPAALogger.warn('Login attempt on locked account', { 
          email: loginData.email,
          lockoutTimeRemaining: lockoutTime,
          ipAddress,
          userAgent
        });
        return { success: false, error: 'Account temporarily locked due to multiple failed attempts' };
      }

      // Find user by email (synchronous)
      const user = this.userRepository.findByEmail(loginData.email);
      if (!user) {
        // Record failed attempt for non-existent user
        accountLockoutUtils.recordFailedAttempt(loginIdentifier);
        
        HIPAALogger.warn('Login attempt with invalid email', { 
          email: loginData.email,
          ipAddress,
          userAgent
        });
        
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if user is active
      if (!user.isActive) {
        HIPAALogger.warn('Login attempt with inactive account', { 
          userId: user.id,
          ipAddress,
          userAgent
        });
        return { success: false, error: 'Account is inactive' };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(loginData.password, user.passwordHash);
      if (!isPasswordValid) {
        // Record failed login attempt
        accountLockoutUtils.recordFailedAttempt(loginIdentifier);
        
        HIPAALogger.warn('Login attempt with invalid password', { 
          userId: user.id,
          ipAddress,
          userAgent,
          failedAttempts: accountLockoutUtils.isLocked(loginIdentifier) ? 'Account now locked' : 'Attempt recorded'
        });
        
        return { success: false, error: 'Invalid credentials' };
      }

      // Clear any previous failed attempts on successful login
      accountLockoutUtils.clearAttempts(loginIdentifier);

      // Generate tokens
      const accessToken = this.jwtUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      const refreshToken = this.jwtUtils.generateRefreshToken({
        userId: user.id,
        tokenVersion: 1 // For future token invalidation
      });

      // Update last login (synchronous)
      this.userRepository.updateLastLogin(user.id);
      
      // Log successful login with security context
      HIPAALogger.info('Successful authentication', { 
        userId: user.id,
        ipAddress,
        userAgent,
        loginTime: new Date().toISOString()
      });

      // Remove password hash from response
      const userResponse = this.excludePasswordHash(user);

      const expiresAt = this.jwtUtils.getTokenExpiry().toISOString();

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return {
        success: true,
        data: {
          token: accessToken,
          refreshToken,
          user: userResponse,
          expiresAt
        }
      };
    } catch (error) {
      // Record failed attempt on any error
      accountLockoutUtils.recordFailedAttempt(loginIdentifier);
      
      HIPAALogger.error('Login error', { 
        error: error.message,
        email: loginData.email,
        ipAddress,
        userAgent
      });
      
      return { success: false, error: 'Authentication failed' };
    }
  }

  async verifyToken(token: string): Promise<ServiceResult<Omit<User, 'passwordHash'>>> {
    try {
      // Check if token is blacklisted
      if (this.tokenBlacklist.has(token)) {
        return { success: false, error: 'Token has been invalidated' };
      }

      // Verify token
      const payload = this.jwtUtils.verifyAccessToken(token);

      // Get user from database (synchronous)
      const user = this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        return { success: false, error: 'User not found or inactive' };
      }

      return {
        success: true,
        data: this.excludePasswordHash(user)
      };
    } catch (error) {
      logger.debug('Token verification failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  async refreshToken(refreshTokenString: string): Promise<ServiceResult<{ token: string; expiresAt: string }>> {
    try {
      // Verify refresh token
      const payload = this.jwtUtils.verifyRefreshToken(refreshTokenString);

      // Get user from database (synchronous)
      const user = this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        return { success: false, error: 'User not found or inactive' };
      }

      // Generate new access token
      const newAccessToken = this.jwtUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      const expiresAt = this.jwtUtils.getTokenExpiry().toISOString();

      logger.debug('Token refreshed successfully', { userId: user.id });

      return {
        success: true,
        data: {
          token: newAccessToken,
          expiresAt
        }
      };
    } catch (error) {
      logger.debug('Token refresh failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  async logout(token: string): Promise<ServiceResult<void>> {
    try {
      // Add token to blacklist
      this.tokenBlacklist.add(token);
      
      // In production, you might want to store this in Redis or database
      // For now, in-memory blacklist is sufficient for MVP
      
      logger.debug('User logged out successfully');
      
      return { success: true, data: undefined };
    } catch (error) {
      logger.error('Error during logout', { error });
      return { success: false, error: 'Logout failed' };
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long', [
        { field: 'password', message: 'Password must be at least 8 characters long' }
      ]);
    }

    // Check for at least one number or uppercase letter
    const hasNumberOrUpper = /[0-9A-Z]/.test(password);
    if (!hasNumberOrUpper) {
      throw new ValidationError('Password must contain at least one number or uppercase letter', [
        { field: 'password', message: 'Password must contain at least one number or uppercase letter' }
      ]);
    }

    // Check for at least one lowercase letter
    const hasLower = /[a-z]/.test(password);
    if (!hasLower) {
      throw new ValidationError('Password must contain at least one lowercase letter', [
        { field: 'password', message: 'Password must contain at least one lowercase letter' }
      ]);
    }
  }

  private validateLoginData(loginData: LoginRequest): void {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate email
    if (!loginData.email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!this.isValidEmail(loginData.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }

    // Validate password
    if (!loginData.password) {
      errors.push({ field: 'password', message: 'Password is required' });
    }

    if (errors.length > 0) {
      throw new ValidationError('Login validation failed', errors);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private excludePasswordHash(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}