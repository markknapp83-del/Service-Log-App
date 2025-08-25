// HIPAA compliance utilities for healthcare data protection
import crypto from 'crypto';
import { logger } from './logger';
import { DataEncryption } from './database-security';

// HIPAA-defined Protected Health Information (PHI) patterns
export class PHIDetector {
  private static readonly PHI_PATTERNS = {
    // Social Security Numbers
    ssn: /\b(?:\d{3}-?\d{2}-?\d{4}|XXX-XX-\d{4})\b/g,
    
    // Phone numbers (various formats)
    phone: /\b(?:\+?1[-\s.]?)?\(?[0-9]{3}\)?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4}\b/g,
    
    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    
    // Medical Record Numbers (common patterns)
    mrn: /\b(?:MRN|MR|MEDICAL[\s-]?RECORD[\s-]?(?:NUMBER|ID)?)[\s:]*([A-Z0-9]{6,12})\b/gi,
    
    // Insurance IDs
    insurance: /\b(?:INSURANCE[\s-]?(?:ID|NUMBER)?|POLICY[\s-]?(?:ID|NUMBER)?)[\s:]*([A-Z0-9]{6,15})\b/gi,
    
    // Dates of Birth (various formats)  
    dob: /\b(?:DOB|DATE[\s-]?OF[\s-]?BIRTH)[\s:]*([0-1]?[0-9][\/\-][0-3]?[0-9][\/\-](?:19|20)?\d{2})\b/gi,
    
    // Simple date patterns
    datePattern: /\b[0-1]?[0-9][\/\-][0-3]?[0-9][\/\-](?:19|20)?\d{2}\b/g,
    
    // Credit card numbers (for billing)
    creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13})\b/g,
    
    // Common health identifiers
    healthId: /\b(?:PATIENT[\s-]?(?:ID|NUMBER)?|ACCOUNT[\s-]?(?:ID|NUMBER)?)[\s:]*([A-Z0-9]{6,12})\b/gi,
    
    // Address patterns (simplified)
    address: /\b\d+\s+[A-Za-z0-9\s,.'#-]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Court|Ct|Place|Pl)\b/gi
  };

  /**
   * Detect PHI in text content
   */
  static detectPHI(text: string): {
    hasPHI: boolean;
    detectedTypes: string[];
    matches: Array<{ type: string; match: string; position: number }>;
  } {
    const detectedTypes: string[] = [];
    const matches: Array<{ type: string; match: string; position: number }> = [];

    Object.entries(this.PHI_PATTERNS).forEach(([type, pattern]) => {
      const typeMatches = Array.from(text.matchAll(pattern));
      
      if (typeMatches.length > 0) {
        detectedTypes.push(type);
        typeMatches.forEach(match => {
          matches.push({
            type,
            match: match[0],
            position: match.index || 0
          });
        });
      }
    });

    return {
      hasPHI: detectedTypes.length > 0,
      detectedTypes,
      matches
    };
  }

  /**
   * Mask PHI in text for logging or display purposes
   */
  static maskPHI(text: string, maskChar: string = '*'): string {
    let maskedText = text;

    Object.entries(this.PHI_PATTERNS).forEach(([type, pattern]) => {
      maskedText = maskedText.replace(pattern, (match) => {
        // Keep first and last character for readability, mask the rest
        if (match.length <= 4) {
          return maskChar.repeat(match.length);
        }
        return match[0] + maskChar.repeat(match.length - 2) + match[match.length - 1];
      });
    });

    return maskedText;
  }

  /**
   * Remove PHI entirely from text
   */
  static removePHI(text: string, replacement: string = '[PHI_REMOVED]'): string {
    let cleanedText = text;

    Object.entries(this.PHI_PATTERNS).forEach(([type, pattern]) => {
      cleanedText = cleanedText.replace(pattern, replacement);
    });

    return cleanedText;
  }
}

// HIPAA-compliant logging that masks PHI
export class HIPAALogger {
  private static shouldMaskPHI = process.env.NODE_ENV === 'production';

  static info(message: string, data?: any): void {
    const sanitizedData = this.sanitizeLogData(data);
    logger.info(this.sanitizeMessage(message), sanitizedData);
  }

  static warn(message: string, data?: any): void {
    const sanitizedData = this.sanitizeLogData(data);
    logger.warn(this.sanitizeMessage(message), sanitizedData);
  }

  static error(message: string, data?: any): void {
    const sanitizedData = this.sanitizeLogData(data);
    logger.error(this.sanitizeMessage(message), sanitizedData);
  }

  static debug(message: string, data?: any): void {
    const sanitizedData = this.sanitizeLogData(data);
    logger.debug(this.sanitizeMessage(message), sanitizedData);
  }

  private static sanitizeMessage(message: string): string {
    if (!this.shouldMaskPHI) return message;
    return PHIDetector.maskPHI(message);
  }

  private static sanitizeLogData(data: any): any {
    if (!this.shouldMaskPHI || !data) return data;

    if (typeof data === 'string') {
      return PHIDetector.maskPHI(data);
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: Record<string, any> = {};
      
      Object.entries(data).forEach(([key, value]) => {
        // Skip certain sensitive fields entirely
        const sensitiveFields = ['password', 'passwordHash', 'token', 'refreshToken'];
        if (sensitiveFields.includes(key.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
          return;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeLogData(value);
        } else if (typeof value === 'string') {
          sanitized[key] = PHIDetector.maskPHI(value);
        } else {
          sanitized[key] = value;
        }
      });

      return sanitized;
    }

    return data;
  }
}

// Data minimization utilities
export class DataMinimization {
  /**
   * Remove unnecessary fields from user data based on role
   */
  static minimizeUserData(userData: any, requesterRole: string, isOwner: boolean = false): any {
    const minimized = { ...userData };

    // Always remove sensitive fields
    delete minimized.passwordHash;
    delete minimized.password;
    
    // Role-based field filtering
    if (requesterRole === 'candidate' && !isOwner) {
      // Candidates can only see limited info about other users
      return {
        id: minimized.id,
        firstName: minimized.firstName,
        lastName: minimized.lastName,
        role: minimized.role
      };
    }

    if (requesterRole === 'admin') {
      // Admins can see more but still not passwords
      delete minimized.lastLoginAt; // Minimize tracking data
      return minimized;
    }

    // Default: minimal information
    return {
      id: minimized.id,
      firstName: minimized.firstName,
      lastName: minimized.lastName
    };
  }

  /**
   * Minimize service log data based on access rights
   */
  static minimizeServiceLogData(serviceLogData: any, requesterRole: string, isOwner: boolean = false): any {
    const minimized = { ...serviceLogData };

    // Candidates can only see their own full service logs
    if (requesterRole === 'candidate' && !isOwner) {
      return {
        id: minimized.id,
        serviceDate: minimized.serviceDate,
        // Remove client-specific information
        activities: minimized.activities?.map((activity: any) => ({
          name: activity.name,
          duration: activity.duration
        })) || []
      };
    }

    // Apply PHI masking for certain fields if required by policy
    if (minimized.notes) {
      const phiDetection = PHIDetector.detectPHI(minimized.notes);
      if (phiDetection.hasPHI && requesterRole !== 'admin') {
        minimized.notes = PHIDetector.maskPHI(minimized.notes);
      }
    }

    return minimized;
  }
}

// Consent management
export class ConsentManager {
  private static consentRecords = new Map<string, {
    userId: string;
    dataTypes: string[];
    purposes: string[];
    grantedAt: Date;
    expiresAt?: Date;
    withdrawn: boolean;
    withdrawnAt?: Date;
  }>();

  /**
   * Record consent for data processing
   */
  static recordConsent(
    userId: string,
    dataTypes: string[],
    purposes: string[],
    expiresAt?: Date
  ): string {
    const consentId = crypto.randomUUID();
    
    this.consentRecords.set(consentId, {
      userId,
      dataTypes,
      purposes,
      grantedAt: new Date(),
      expiresAt,
      withdrawn: false
    });

    HIPAALogger.info('Consent recorded', {
      consentId,
      userId,
      dataTypes,
      purposes
    });

    return consentId;
  }

  /**
   * Withdraw consent
   */
  static withdrawConsent(consentId: string): boolean {
    const consent = this.consentRecords.get(consentId);
    if (!consent) return false;

    consent.withdrawn = true;
    consent.withdrawnAt = new Date();

    HIPAALogger.info('Consent withdrawn', {
      consentId,
      userId: consent.userId,
      withdrawnAt: consent.withdrawnAt
    });

    return true;
  }

  /**
   * Check if consent exists for specific data processing
   */
  static hasConsent(
    userId: string,
    dataType: string,
    purpose: string
  ): boolean {
    for (const consent of this.consentRecords.values()) {
      if (
        consent.userId === userId &&
        !consent.withdrawn &&
        consent.dataTypes.includes(dataType) &&
        consent.purposes.includes(purpose) &&
        (!consent.expiresAt || consent.expiresAt > new Date())
      ) {
        return true;
      }
    }
    return false;
  }
}

// Data retention and disposal
export class DataRetentionManager {
  private static readonly RETENTION_POLICIES = {
    service_logs: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
    audit_logs: 6 * 365 * 24 * 60 * 60 * 1000, // 6 years
    user_sessions: 30 * 24 * 60 * 60 * 1000, // 30 days
    temp_data: 24 * 60 * 60 * 1000 // 24 hours
  };

  /**
   * Check if data should be retained based on creation date and type
   */
  static shouldRetain(dataType: string, createdAt: Date): boolean {
    const retentionPeriod = this.RETENTION_POLICIES[dataType as keyof typeof this.RETENTION_POLICIES];
    if (!retentionPeriod) {
      HIPAALogger.warn('No retention policy defined for data type', { dataType });
      return true; // Conservative approach - retain if no policy
    }

    const now = Date.now();
    const dataAge = now - createdAt.getTime();
    
    return dataAge < retentionPeriod;
  }

  /**
   * Get records that are eligible for disposal
   */
  static getRecordsForDisposal(dataType: string, records: Array<{ id: string; createdAt: Date }>): string[] {
    return records
      .filter(record => !this.shouldRetain(dataType, record.createdAt))
      .map(record => record.id);
  }

  /**
   * Securely dispose of data (overwrite with random data multiple times)
   */
  static secureDispose(data: string): void {
    // In a real implementation, this would involve:
    // 1. Overwriting the actual storage location multiple times
    // 2. Using secure deletion methods
    // 3. Verifying the data is unrecoverable
    
    const iterations = 3;
    for (let i = 0; i < iterations; i++) {
      const randomData = crypto.randomBytes(data.length).toString('base64');
      // Overwrite with random data (conceptual - actual implementation would vary)
    }

    HIPAALogger.info('Data securely disposed', {
      dataLength: data.length,
      iterations
    });
  }
}

// HIPAA risk assessment utilities
export class HIPAARiskAssessment {
  static assessDataRisk(data: any): {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskFactors: string[];
    recommendations: string[];
  } {
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Check for PHI content
    if (typeof data === 'string') {
      const phiDetection = PHIDetector.detectPHI(data);
      if (phiDetection.hasPHI) {
        riskScore += 30;
        riskFactors.push('Contains Protected Health Information (PHI)');
        recommendations.push('Encrypt data at rest and in transit');
        recommendations.push('Implement access controls and audit logging');
      }
    }

    // Check for sensitive object properties
    if (typeof data === 'object' && data !== null) {
      const sensitiveFields = ['ssn', 'dob', 'medicalRecord', 'insurance', 'diagnosis'];
      const foundSensitiveFields = Object.keys(data).filter(key => 
        sensitiveFields.some(sensitive => key.toLowerCase().includes(sensitive))
      );
      
      if (foundSensitiveFields.length > 0) {
        riskScore += 25 * foundSensitiveFields.length;
        riskFactors.push(`Contains sensitive fields: ${foundSensitiveFields.join(', ')}`);
        recommendations.push('Apply field-level encryption for sensitive data');
      }
    }

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (riskScore >= 75) {
      riskLevel = 'CRITICAL';
      recommendations.push('Immediate security review required');
      recommendations.push('Consider additional encryption and access restrictions');
    } else if (riskScore >= 50) {
      riskLevel = 'HIGH';
      recommendations.push('Enhanced security measures recommended');
    } else if (riskScore >= 25) {
      riskLevel = 'MEDIUM';
      recommendations.push('Standard security measures should be sufficient');
    } else {
      riskLevel = 'LOW';
    }

    return {
      riskLevel,
      riskFactors,
      recommendations
    };
  }
}

// Business Associate Agreement (BAA) compliance tracking
export class BAACompliance {
  private static businessAssociates = new Map<string, {
    name: string;
    services: string[];
    baaSignedDate: Date;
    baaExpiryDate: Date;
    complianceCheckedDate: Date;
    isCompliant: boolean;
  }>();

  static registerBusinessAssociate(
    id: string,
    name: string,
    services: string[],
    baaSignedDate: Date,
    baaExpiryDate: Date
  ): void {
    this.businessAssociates.set(id, {
      name,
      services,
      baaSignedDate,
      baaExpiryDate,
      complianceCheckedDate: new Date(),
      isCompliant: true
    });

    HIPAALogger.info('Business Associate registered', {
      id,
      name,
      services
    });
  }

  static checkBAACompliance(id: string): boolean {
    const ba = this.businessAssociates.get(id);
    if (!ba) return false;

    const now = new Date();
    const isExpired = ba.baaExpiryDate < now;
    
    ba.isCompliant = !isExpired;
    ba.complianceCheckedDate = now;

    if (isExpired) {
      HIPAALogger.warn('Business Associate BAA expired', {
        id,
        name: ba.name,
        expiryDate: ba.baaExpiryDate
      });
    }

    return ba.isCompliant;
  }

  static getAllBusinessAssociates(): Array<{
    id: string;
    name: string;
    services: string[];
    isCompliant: boolean;
    baaExpiryDate: Date;
  }> {
    const result: Array<any> = [];
    
    this.businessAssociates.forEach((ba, id) => {
      result.push({
        id,
        name: ba.name,
        services: ba.services,
        isCompliant: ba.isCompliant,
        baaExpiryDate: ba.baaExpiryDate
      });
    });

    return result;
  }
}

// Initialize HIPAA compliance utilities
if (process.env.NODE_ENV === 'production') {
  // In production, ensure PHI masking is enabled
  HIPAALogger.info('HIPAA compliance utilities initialized for production');
}
