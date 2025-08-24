// Authentication service following service layer patterns
import { UserRepository } from '@/models/UserRepository.js';
import { JWTUtils } from '@/utils/jwt.js';
import { logger } from '@/utils/logger.js';
import { 
  LoginRequest, 
  LoginResponse, 
  User, 
  ApiResponse,
  Result 
} from '@/types/index.js';
import { AuthenticationError, ValidationError } from '@/utils/errors.js';
import bcrypt from 'bcryptjs';

export class AuthService {
  private jwtUtils: JWTUtils;
  private tokenBlacklist: Set<string> = new Set();

  constructor(private userRepository: UserRepository) {
    this.jwtUtils = new JWTUtils();
  }

  async login(loginData: LoginRequest): Promise<Result<LoginResponse, string>> {
    try {
      // Validate input
      this.validateLoginData(loginData);

      // Find user by email
      const user = await this.userRepository.findByEmail(loginData.email);
      if (!user) {
        logger.warn('Login attempt with invalid email', { email: loginData.email });
        return { ok: false, error: 'Invalid credentials' };
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn('Login attempt with inactive account', { userId: user.id });
        return { ok: false, error: 'Account is inactive' };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(loginData.password, user.passwordHash);
      if (!isPasswordValid) {
        logger.warn('Login attempt with invalid password', { userId: user.id });
        return { ok: false, error: 'Invalid credentials' };
      }

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

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Remove password hash from response
      const userResponse = this.excludePasswordHash(user);

      const expiresAt = this.jwtUtils.getTokenExpiry().toISOString();

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return {
        ok: true,
        value: {
          token: accessToken,
          refreshToken,
          user: userResponse,
          expiresAt
        }
      };
    } catch (error) {
      logger.error('Error during login', { error, email: loginData.email });
      return { ok: false, error: 'Login failed' };
    }
  }

  async verifyToken(token: string): Promise<Result<Omit<User, 'passwordHash'>, string>> {
    try {
      // Check if token is blacklisted
      if (this.tokenBlacklist.has(token)) {
        return { ok: false, error: 'Token has been invalidated' };
      }

      // Verify token
      const payload = this.jwtUtils.verifyAccessToken(token);

      // Get user from database
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        return { ok: false, error: 'User not found or inactive' };
      }

      return {
        ok: true,
        value: this.excludePasswordHash(user)
      };
    } catch (error) {
      logger.debug('Token verification failed', { error: (error as Error).message });
      return { ok: false, error: (error as Error).message };
    }
  }

  async refreshToken(refreshTokenString: string): Promise<Result<{ token: string; expiresAt: string }, string>> {
    try {
      // Verify refresh token
      const payload = this.jwtUtils.verifyRefreshToken(refreshTokenString);

      // Get user from database
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        return { ok: false, error: 'User not found or inactive' };
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
        ok: true,
        value: {
          token: newAccessToken,
          expiresAt
        }
      };
    } catch (error) {
      logger.debug('Token refresh failed', { error: (error as Error).message });
      return { ok: false, error: (error as Error).message };
    }
  }

  async logout(token: string): Promise<Result<void, string>> {
    try {
      // Add token to blacklist
      this.tokenBlacklist.add(token);
      
      // In production, you might want to store this in Redis or database
      // For now, in-memory blacklist is sufficient for MVP
      
      logger.debug('User logged out successfully');
      
      return { ok: true, value: undefined };
    } catch (error) {
      logger.error('Error during logout', { error });
      return { ok: false, error: 'Logout failed' };
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