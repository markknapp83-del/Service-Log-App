// Authentication Service tests following Jest documentation patterns
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AuthService } from '@/services/AuthService';
import { UserRepository } from '@/models/UserRepository';
import { AuthenticationError, ValidationError } from '@/utils/errors';
import bcrypt from 'bcryptjs';

// Mock the repository
jest.mock('@/models/UserRepository');
jest.mock('bcryptjs');

const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Helper to create mock user
const createMockUser = (overrides: any = {}) => ({
  id: 'test-user-id',
  email: 'user@healthcare.local',
  username: 'testuser',
  passwordHash: '$2a$12$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  role: 'candidate' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = new mockUserRepository() as jest.Mocked<UserRepository>;
    authService = new AuthService(mockRepository);
    
    // Mock JWT utils
    const mockJWTUtils = {
      generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
      generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
      verifyAccessToken: jest.fn().mockReturnValue({ userId: 'test-user-id', email: 'user@healthcare.local', role: 'candidate' }),
      verifyRefreshToken: jest.fn().mockReturnValue({ userId: 'test-user-id', tokenVersion: 1 }),
      getTokenExpiry: jest.fn().mockReturnValue(new Date())
    };
    (authService as any).jwtUtils = mockJWTUtils;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('successfully authenticates user with valid credentials', async () => {
      const mockUser = createMockUser({
        email: 'user@healthcare.local',
        passwordHash: '$2a$12$hashedpassword'
      });
      const loginData = {
        email: 'user@healthcare.local',
        password: 'validpassword123'
      };

      mockRepository.findByEmail.mockReturnValue(mockUser);
      mockRepository.updateLastLogin.mockReturnValue();
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await authService.login(loginData);

      expect(mockRepository.findByEmail).toHaveBeenCalledWith('user@healthcare.local');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('validpassword123', mockUser.passwordHash);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.token).toBeDefined();
        expect(result.data.refreshToken).toBeDefined();
        expect(result.data.user.email).toBe('user@healthcare.local');
        expect((result.data.user as any).passwordHash).toBeUndefined(); // Should not include password hash
      }
    });

    test('rejects login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@healthcare.local',
        password: 'password123'
      };

      mockRepository.findByEmail.mockReturnValue(null);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/invalid credentials/i);
      }
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    test('rejects login with invalid password', async () => {
      const mockUser = createMockUser({
        email: 'user@healthcare.local'
      });
      const loginData = {
        email: 'user@healthcare.local',
        password: 'wrongpassword'
      };

      mockRepository.findByEmail.mockReturnValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/invalid credentials/i);
      }
    });

    test('rejects login for inactive user', async () => {
      const mockUser = createMockUser({
        email: 'user@healthcare.local',
        isActive: false
      });
      const loginData = {
        email: 'user@healthcare.local',
        password: 'password123'
      };

      mockRepository.findByEmail.mockReturnValue(mockUser);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/account is inactive/i);
      }
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    test('validates email format', async () => {
      const invalidLoginData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const result = await authService.login(invalidLoginData);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/login failed/i);
      }
    });

    test('validates password requirements', async () => {
      const invalidLoginData = {
        email: 'user@healthcare.local',
        password: ''
      };

      const result = await authService.login(invalidLoginData);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/login failed/i);
      }
    });
  });

  describe('verifyToken', () => {
    test('successfully verifies valid JWT token', async () => {
      const mockUser = createMockUser();
      mockRepository.findById.mockReturnValue(mockUser);

      const result = await authService.verifyToken('valid-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe(mockUser.email);
        expect((result.data as any).passwordHash).toBeUndefined();
      }
    });

    test('rejects expired token', async () => {
      const mockJWTUtils = (authService as any).jwtUtils;
      mockJWTUtils.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = await authService.verifyToken('expired-token');

      expect(result.success).toBe(false);
    });

    test('rejects invalid token', async () => {
      const mockJWTUtils = (authService as any).jwtUtils;
      mockJWTUtils.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.verifyToken('invalid-token');

      expect(result.success).toBe(false);
    });
  });

  describe('refreshToken', () => {
    test('successfully generates new access token with valid refresh token', async () => {
      const mockUser = createMockUser();
      mockRepository.findById.mockReturnValue(mockUser);

      const result = await authService.refreshToken('valid-refresh-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBeDefined();
        expect(result.data.expiresAt).toBeDefined();
      }
    });

    test('rejects invalid refresh token', async () => {
      const mockJWTUtils = (authService as any).jwtUtils;
      mockJWTUtils.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid refresh token');
      });

      const result = await authService.refreshToken('invalid-refresh-token');

      expect(result.success).toBe(false);
    });
  });

  describe('hashPassword', () => {
    test('hashes password with correct salt rounds', async () => {
      mockBcrypt.hash.mockResolvedValue('$2a$12$hashedpassword' as never);

      const hashedPassword = await authService.hashPassword('password123');

      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(hashedPassword).toBe('$2a$12$hashedpassword');
    });
  });

  describe('validatePassword', () => {
    test('validates password requirements', () => {
      expect(() => {
        authService.validatePassword('ValidPass123');
      }).not.toThrow();
    });

    test('rejects weak passwords', () => {
      expect(() => {
        authService.validatePassword('weak');
      }).toThrow(ValidationError);

      expect(() => {
        authService.validatePassword('nouppercase');
      }).toThrow(ValidationError);

      expect(() => {
        authService.validatePassword('NOLOWERCASE123');
      }).toThrow(ValidationError);

      expect(() => {
        authService.validatePassword('nonumbers');
      }).toThrow(ValidationError);
    });
  });

  describe('logout', () => {
    test('successfully invalidates token', async () => {
      const result = await authService.logout('valid-token');
      
      expect(result.success).toBe(true);
    });
  });
});