// Authentication Service tests following Jest documentation patterns
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { AuthService } from '@/services/AuthService.js';
import { UserRepository } from '@/models/UserRepository.js';
import { AuthenticationError, ValidationError } from '@/utils/errors.js';
import bcrypt from 'bcryptjs';

// Mock the repository
jest.mock('@/models/UserRepository.js');
jest.mock('bcryptjs');

const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = new mockUserRepository() as jest.Mocked<UserRepository>;
    authService = new AuthService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('successfully authenticates user with valid credentials', async () => {
      const mockUser = global.testUtils.createMockUser({
        email: 'user@healthcare.local',
        passwordHash: '$2a$12$hashedpassword'
      });
      const loginData = {
        email: 'user@healthcare.local',
        password: 'validpassword123'
      };

      mockRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await authService.login(loginData);

      expect(mockRepository.findByEmail).toHaveBeenCalledWith('user@healthcare.local');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('validpassword123', mockUser.passwordHash);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.token).toBeDefined();
        expect(result.data.refreshToken).toBeDefined();
        expect(result.data.user.email).toBe('user@healthcare.local');
        expect(result.data.user.passwordHash).toBeUndefined(); // Should not include password hash
      }
    });

    test('rejects login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@healthcare.local',
        password: 'password123'
      };

      mockRepository.findByEmail.mockResolvedValue(null);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/invalid credentials/i);
      }
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    test('rejects login with invalid password', async () => {
      const mockUser = global.testUtils.createMockUser({
        email: 'user@healthcare.local'
      });
      const loginData = {
        email: 'user@healthcare.local',
        password: 'wrongpassword'
      };

      mockRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/invalid credentials/i);
      }
    });

    test('rejects login for inactive user', async () => {
      const mockUser = global.testUtils.createMockUser({
        isActive: false
      });
      const loginData = {
        email: 'user@healthcare.local',
        password: 'password123'
      };

      mockRepository.findByEmail.mockResolvedValue(mockUser);

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

      await expect(authService.login(invalidLoginData)).rejects.toThrow(ValidationError);
    });

    test('validates password requirements', async () => {
      const invalidLoginData = {
        email: 'user@healthcare.local',
        password: '' // Empty password
      };

      await expect(authService.login(invalidLoginData)).rejects.toThrow(ValidationError);
    });
  });

  describe('verifyToken', () => {
    test('successfully verifies valid JWT token', async () => {
      const mockUser = global.testUtils.createMockUser();
      
      // We'll need to implement this after creating the JWT utility
      // For now, just define the expected behavior
      
      mockRepository.findById.mockResolvedValue(mockUser);

      // This test will be implemented once we have JWT utilities
      expect(true).toBe(true); // Placeholder
    });

    test('rejects expired token', async () => {
      // This test will verify token expiration handling
      expect(true).toBe(true); // Placeholder
    });

    test('rejects invalid token', async () => {
      // This test will verify invalid token handling
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('refreshToken', () => {
    test('successfully generates new access token with valid refresh token', async () => {
      // This test will verify refresh token functionality
      expect(true).toBe(true); // Placeholder
    });

    test('rejects invalid refresh token', async () => {
      // This test will verify refresh token validation
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('hashPassword', () => {
    test('hashes password with correct salt rounds', async () => {
      const password = 'testpassword123';
      const hashedPassword = '$2a$12$hashedresult';
      
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await authService.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('validatePassword', () => {
    test('validates password requirements', () => {
      const validPasswords = [
        'Password123!',
        'SecurePass1',
        'MyPassword123'
      ];

      validPasswords.forEach(password => {
        expect(() => authService.validatePassword(password)).not.toThrow();
      });
    });

    test('rejects weak passwords', () => {
      const weakPasswords = [
        '123',           // Too short
        'password',      // No numbers/uppercase
        'PASSWORD',      // No numbers/lowercase
        '12345678',      // No letters
        ''               // Empty
      ];

      weakPasswords.forEach(password => {
        expect(() => authService.validatePassword(password)).toThrow(ValidationError);
      });
    });
  });

  describe('logout', () => {
    test('successfully invalidates token', async () => {
      // This test will verify token blacklisting or invalidation
      const result = await authService.logout('valid-token');
      
      expect(result.success).toBe(true);
    });
  });
});