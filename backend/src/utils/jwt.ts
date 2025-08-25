// JWT utilities following TypeScript and security patterns
import jwt from 'jsonwebtoken';
import { JWTPayload, RefreshTokenPayload } from '@/types/index';
import { logger } from './logger';

export class JWTUtils {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || '';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || '';
    this.accessTokenExpiry = process.env.NODE_ENV === 'production' ? '15m' : '1h';
    this.refreshTokenExpiry = '7d';

    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error('JWT secrets must be configured');
    }
  }

  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      return jwt.sign(
        payload as object,
        this.accessTokenSecret,
        {
          expiresIn: this.accessTokenExpiry,
          issuer: 'healthcare-portal',
          audience: 'healthcare-portal-client'
        }
      );
    } catch (error) {
      logger.error('Error generating access token', { error });
      throw new Error('Failed to generate access token');
    }
  }

  generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    try {
      return jwt.sign(
        payload as object,
        this.refreshTokenSecret,
        {
          expiresIn: this.refreshTokenExpiry,
          issuer: 'healthcare-portal',
          audience: 'healthcare-portal-client'
        }
      );
    } catch (error) {
      logger.error('Error generating refresh token', { error });
      throw new Error('Failed to generate refresh token');
    }
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'healthcare-portal',
        audience: 'healthcare-portal-client'
      }) as JWTPayload;
      
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        logger.error('Error verifying access token', { error });
        throw new Error('Token verification failed');
      }
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'healthcare-portal',
        audience: 'healthcare-portal-client'
      }) as RefreshTokenPayload;
      
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        logger.error('Error verifying refresh token', { error });
        throw new Error('Refresh token verification failed');
      }
    }
  }

  getTokenExpiry(): Date {
    // Calculate when the access token will expire
    const now = new Date();
    const expiryMinutes = this.accessTokenExpiry === '15m' ? 15 : 60;
    return new Date(now.getTime() + (expiryMinutes * 60 * 1000));
  }

  extractTokenFromBearer(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.substring(7);
  }
}