# Healthcare Service Log Portal - API Documentation

## Version: 1.0.0
## Base URL: `http://localhost:3001/api` (Development) | `https://your-domain.com/api` (Production)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Security](#authentication--security)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Admin Management](#admin-management-endpoints)
   - [Service Logs](#service-log-endpoints)
   - [Reports & Analytics](#reports--analytics-endpoints)
   - [Monitoring & Health](#monitoring--health-endpoints)
   - [Client Error Logging](#client-error-logging-endpoints)
6. [Data Models](#data-models)
7. [Environment Configuration](#environment-configuration)
8. [Development Setup](#development-setup)
9. [Production Deployment](#production-deployment)
10. [Security Considerations](#security-considerations)

---

## Overview

The Healthcare Service Log Portal API provides secure, HIPAA-compliant endpoints for managing healthcare service delivery tracking. This RESTful API supports authentication, service log management, reporting, and administrative functions with comprehensive security measures.

### Key Features

- **HIPAA Compliant**: Full audit logging and data protection
- **Role-Based Access Control**: Admin and candidate user roles
- **Real-time Monitoring**: Comprehensive health checks and alerting
- **Secure Authentication**: JWT-based with refresh token support
- **Rate Limited**: Protection against abuse and DoS attacks
- **Comprehensive Logging**: Detailed audit trails for all operations
- **Error Tracking**: Client-side error collection and analysis

### API Standards

- RESTful architecture with consistent HTTP methods
- JSON request/response format
- ISO 8601 date formatting
- UUID-based resource identifiers
- Comprehensive error codes and messages
- Paginated list responses

---

## Authentication & Security

### JWT Authentication

All protected endpoints require a valid JWT access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Lifecycle

- **Access Token**: 15 minutes expiration
- **Refresh Token**: 7 days expiration
- **Token Refresh**: Use `/api/auth/refresh` endpoint

### HIPAA Compliance

- All patient data interactions are logged
- PHI (Protected Health Information) is never included in error responses
- Audit trails maintained for all data modifications
- Secure token storage and transmission

### Security Headers

```
Content-Security-Policy: strict policy in production
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: enforced in production
```

### CORS Configuration

- **Development**: Allows any `localhost` origin
- **Production**: Configured origins only via `CORS_ORIGIN` environment variable

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication token |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions for requested resource |
| `VALIDATION_ERROR` | 400 | Request data validation failed |
| `NOT_FOUND` | 404 | Requested resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., email already exists) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

### Healthcare-Specific Error Codes

| Code | Description |
|------|-------------|
| `PATIENT_DATA_ERROR` | Error processing patient information |
| `SERVICE_LOG_VALIDATION` | Service log data validation failed |
| `HIPAA_COMPLIANCE_ERROR` | HIPAA compliance violation detected |
| `AUDIT_LOG_FAILURE` | Failed to create audit log entry |

---

## Rate Limiting

### General API Limits

- **Standard Endpoints**: 100 requests per 15 minutes (production) / 10,000 (development)
- **Authentication Endpoints**: 5 requests per 15 minutes (production) / 50 (development)
- **Client Error Reporting**: 50 errors per 5 minutes
- **Critical Error Reporting**: 10 errors per 1 minute

### Rate Limit Headers

```
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1638360000
```

### Role-Based Limits

- **Admin Users**: Higher limits for administrative operations
- **Candidate Users**: Standard limits for service logging
- **Anonymous Users**: Restricted to authentication endpoints only

---

## API Endpoints

## Authentication Endpoints

### POST /api/auth/login

Authenticate user and receive access tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "candidate",
      "isActive": true
    },
    "expiresAt": "2023-12-01T10:15:00.000Z"
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

**Error Responses:**
- `400` - Validation error (invalid email format, missing fields)
- `401` - Invalid credentials
- `429` - Rate limit exceeded

---

### POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2023-12-01T10:15:00.000Z"
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

### POST /api/auth/logout

**Headers:** `Authorization: Bearer <token>`

Logout user and invalidate tokens.

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

### GET /api/auth/verify

**Headers:** `Authorization: Bearer <token>`

Verify current token and get user information.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "candidate",
      "isActive": true
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

### GET /api/auth/me

**Headers:** `Authorization: Bearer <token>`

Alias for `/api/auth/verify` - get current user profile.

---

## Admin Management Endpoints

**All admin endpoints require `admin` role and authentication.**

### User Management

#### GET /api/admin/users

List users with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (max: 100, default: 20)
- `search` (optional): Search by name or email (min: 2 chars)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "candidate",
        "isActive": true,
        "lastLoginAt": "2023-12-01T09:00:00.000Z",
        "createdAt": "2023-11-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

#### GET /api/admin/users/:id

Get single user details.

**Parameters:**
- `id`: User UUID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "candidate",
      "isActive": true,
      "lastLoginAt": "2023-12-01T09:00:00.000Z",
      "createdAt": "2023-11-01T10:00:00.000Z",
      "updatedAt": "2023-11-15T14:30:00.000Z"
    }
  }
}
```

---

#### POST /api/admin/users

Create new user.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "candidate"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "newuser@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "candidate",
      "isActive": true,
      "createdAt": "2023-12-01T10:00:00.000Z"
    }
  }
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one lowercase letter
- At least one uppercase letter  
- At least one number

---

#### PUT /api/admin/users/:id

Update user (excludes password updates).

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe Updated",
  "role": "admin",
  "isActive": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "firstName": "John",
      "lastName": "Doe Updated",
      "role": "admin",
      "isActive": false,
      "updatedAt": "2023-12-01T10:00:00.000Z"
    }
  }
}
```

---

#### DELETE /api/admin/users/:id

Soft delete (deactivate) user.

**Response (200):**
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

#### POST /api/admin/users/:id/reset-password

Reset user password.

**Request Body:**
```json
{
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

### Template Management

#### GET /api/admin/templates/clients

List all clients with usage statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "1",
        "name": "Downtown Health Center",
        "isActive": true,
        "createdAt": "2023-11-01T10:00:00.000Z",
        "usageCount": 45
      }
    ]
  }
}
```

---

#### POST /api/admin/templates/clients

Create new client.

**Request Body:**
```json
{
  "name": "New Health Center",
  "isActive": true
}
```

---

#### PUT /api/admin/templates/clients/:id

Update client.

**Request Body:**
```json
{
  "name": "Updated Health Center",
  "isActive": false
}
```

---

#### DELETE /api/admin/templates/clients/:id

Delete client (if not referenced by service logs).

---

#### GET /api/admin/templates/activities

List all activities with usage statistics.

---

#### POST /api/admin/templates/activities

Create new activity.

---

#### PUT /api/admin/templates/activities/:id

Update activity.

---

#### DELETE /api/admin/templates/activities/:id

Delete activity.

---

#### GET /api/admin/templates/outcomes

List all outcomes with usage statistics.

---

#### POST /api/admin/templates/outcomes

Create new outcome.

---

#### PUT /api/admin/templates/outcomes/:id

Update outcome.

---

#### DELETE /api/admin/templates/outcomes/:id

Delete outcome.

---

## Service Log Endpoints

**All service log endpoints require authentication.**

### GET /api/service-logs/options

Get form dropdown options (clients, activities, outcomes).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "1",
        "name": "Downtown Health Center",
        "isActive": true
      }
    ],
    "activities": [
      {
        "id": "1", 
        "name": "General Consultation",
        "isActive": true
      }
    ],
    "outcomes": [
      {
        "id": "1",
        "name": "Completed Successfully",
        "isActive": true
      }
    ]
  }
}
```

---

### GET /api/service-logs

List service logs with filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `isDraft` (optional): Filter by draft status ("true"/"false")
- `clientId` (optional): Filter by client ID
- `activityId` (optional): Filter by activity ID
- `dateFrom` (optional): Start date filter (ISO 8601 or YYYY-MM-DD)
- `dateTo` (optional): End date filter (ISO 8601 or YYYY-MM-DD)
- `userId` (optional): Filter by user ID (admin only)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "serviceLogs": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "clientId": "1",
        "activityId": "1", 
        "serviceDate": "2023-12-01",
        "patientCount": 3,
        "isDraft": false,
        "submittedAt": "2023-12-01T10:00:00.000Z",
        "client": {
          "name": "Downtown Health Center"
        },
        "activity": {
          "name": "General Consultation"
        },
        "user": {
          "firstName": "John",
          "lastName": "Doe"
        },
        "patientEntries": [
          {
            "id": "patient-entry-1",
            "appointmentType": "new",
            "outcomeId": "1",
            "outcome": {
              "name": "Completed Successfully"
            }
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### GET /api/service-logs/:id

Get single service log with full details.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "serviceLog": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "clientId": "1",
      "activityId": "1",
      "serviceDate": "2023-12-01",
      "patientCount": 3,
      "isDraft": false,
      "submittedAt": "2023-12-01T10:00:00.000Z",
      "createdAt": "2023-12-01T09:00:00.000Z",
      "updatedAt": "2023-12-01T10:00:00.000Z",
      "client": {
        "id": "1",
        "name": "Downtown Health Center"
      },
      "activity": {
        "id": "1",
        "name": "General Consultation"
      },
      "user": {
        "id": "user-id",
        "firstName": "John",
        "lastName": "Doe"
      },
      "patientEntries": [
        {
          "id": "patient-entry-1",
          "appointmentType": "new",
          "outcomeId": "1",
          "outcome": {
            "id": "1",
            "name": "Completed Successfully"
          },
          "createdAt": "2023-12-01T09:00:00.000Z"
        },
        {
          "id": "patient-entry-2", 
          "appointmentType": "followup",
          "outcomeId": "1",
          "outcome": {
            "id": "1",
            "name": "Completed Successfully"
          },
          "createdAt": "2023-12-01T09:00:00.000Z"
        }
      ]
    }
  }
}
```

---

### POST /api/service-logs

Create new service log.

**Request Body:**
```json
{
  "clientId": "1",
  "activityId": "1",
  "serviceDate": "2023-12-01",
  "patientCount": 2,
  "isDraft": false,
  "patientEntries": [
    {
      "appointmentType": "new",
      "outcomeId": "1"
    },
    {
      "appointmentType": "followup", 
      "outcomeId": "2"
    }
  ]
}
```

**Validation Rules:**
- `patientEntries.length` must equal `patientCount`
- Each patient entry represents one appointment
- `appointmentType` must be "new", "followup", or "dna"
- `outcomeId` is required for all entries
- `serviceDate` is required

**Response (201):**
```json
{
  "success": true,
  "data": {
    "serviceLog": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "clientId": "1",
      "activityId": "1",
      "serviceDate": "2023-12-01", 
      "patientCount": 2,
      "isDraft": false,
      "submittedAt": "2023-12-01T10:00:00.000Z",
      "createdAt": "2023-12-01T10:00:00.000Z"
    }
  }
}
```

---

### PUT /api/service-logs/:id

Update existing service log.

**Request Body:** (all fields optional)
```json
{
  "clientId": "2",
  "activityId": "2",
  "patientCount": 3,
  "isDraft": true,
  "patientEntries": [
    {
      "appointmentType": "new",
      "outcomeId": "1"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "serviceLog": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "clientId": "2",
      "activityId": "2",
      "patientCount": 3,
      "isDraft": true,
      "updatedAt": "2023-12-01T10:30:00.000Z"
    }
  }
}
```

---

### DELETE /api/service-logs/:id

Delete service log (soft delete).

**Response (200):**
```json
{
  "success": true,
  "message": "Service log deleted successfully",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

## Reports & Analytics Endpoints

### GET /api/reports/export

Export service logs data to CSV or Excel format.

**Query Parameters:**
- `format` (optional): "csv" or "excel" (default: "csv")
- `dateFrom` (optional): Start date filter
- `dateTo` (optional): End date filter
- `clientId` (optional): Filter by client
- `activityId` (optional): Filter by activity
- `userId` (optional): Filter by user (admin only)
- `isDraft` (optional): Filter by draft status

**Response (200):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="service-logs-export-2023-12-01.csv"

Service Date,Client,Activity,User,Patient Count,Appointment Types,Outcomes,Status
2023-12-01,Downtown Health Center,General Consultation,John Doe,3,"new:2,followup:1","Completed:2,DNA:1",Final
```

**Excel Format Response:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="service-logs-export-2023-12-01.xlsx"
```

---

### GET /api/reports/summary

Get analytics and summary statistics.

**Query Parameters:**
- `dateFrom` (optional): Start date for analysis
- `dateTo` (optional): End date for analysis  
- `clientId` (optional): Filter by client
- `activityId` (optional): Filter by activity
- `userId` (optional): Filter by user (admin only)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalServiceLogs": 145,
      "totalPatients": 423,
      "draftServiceLogs": 12,
      "completedServiceLogs": 133,
      "dateRange": {
        "from": "2023-11-01T00:00:00.000Z",
        "to": "2023-12-01T23:59:59.999Z"
      }
    },
    "appointmentTypes": {
      "new": 234,
      "followup": 156,
      "dna": 33
    },
    "outcomes": {
      "Completed Successfully": 367,
      "Did Not Attend": 33,
      "Referred": 23
    },
    "topClients": [
      {
        "clientId": "1",
        "name": "Downtown Health Center",
        "serviceLogCount": 45,
        "patientCount": 134
      }
    ],
    "topActivities": [
      {
        "activityId": "1", 
        "name": "General Consultation",
        "serviceLogCount": 78,
        "patientCount": 245
      }
    ],
    "dailyTrends": [
      {
        "date": "2023-11-01",
        "serviceLogCount": 5,
        "patientCount": 12
      }
    ],
    "userActivity": [
      {
        "userId": "user-1",
        "firstName": "John",
        "lastName": "Doe", 
        "serviceLogCount": 23,
        "patientCount": 67
      }
    ]
  }
}
```

---

## Monitoring & Health Endpoints

### GET /api/health

Public health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "uptime": 86400,
  "responseTime": "2ms",
  "service": "healthcare-portal-backend",
  "version": "1.0.0"
}
```

---

### GET /api/health/detailed

**Headers:** `Authorization: Bearer <token>`

Detailed health check for authenticated users.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overall": {
      "status": "healthy",
      "responseTime": "15ms",
      "timestamp": "2023-12-01T10:00:00.000Z",
      "uptime": 86400
    },
    "system": {
      "memory": {
        "used": "145MB",
        "total": "512MB",
        "percentage": 28.3
      },
      "cpu": {
        "usage": 15.2
      }
    },
    "database": {
      "status": "connected",
      "responseTime": "3ms",
      "metrics": {
        "totalQueries": 1234,
        "avgQueryTime": "2.3ms"
      }
    },
    "alerts": {
      "statistics": {
        "total": 5,
        "active": 1,
        "resolved": 4
      },
      "active": [
        {
          "id": "alert-1",
          "type": "performance",
          "severity": "medium",
          "message": "Response time elevated"
        }
      ],
      "hasActiveCritical": false
    },
    "healthChecks": [
      {
        "name": "Database Connection",
        "status": "pass"
      },
      {
        "name": "Memory Usage",
        "status": "pass",
        "result": {
          "rss": "145MB",
          "heapUsed": "89MB"
        }
      }
    ]
  }
}
```

---

### GET /api/health/admin

**Headers:** `Authorization: Bearer <admin_token>`

Comprehensive system status for administrators.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "system": {
      "status": "operational",
      "responseTime": "12ms",
      "metrics": {
        "uptime": 86400,
        "memoryUsage": 28.3,
        "cpuUsage": 15.2
      },
      "disk": {
        "free": "2048 MB",
        "total": "4096 MB",
        "usage": "50%",
        "status": "ok"
      },
      "memory": {
        "process": {
          "rss": "145 MB",
          "heapTotal": "112 MB",
          "heapUsed": "89 MB"
        },
        "system": {
          "total": "8192 MB",
          "free": "4096 MB",
          "used": "4096 MB",
          "usage": "50%"
        }
      },
      "process": {
        "pid": 12345,
        "uptime": "86400 seconds",
        "nodeVersion": "v18.17.0",
        "platform": "win32",
        "arch": "x64",
        "env": "development"
      }
    },
    "network": {
      "externalServices": {
        "healthApi": "connected",
        "database": "connected"
      },
      "internalServices": {
        "monitoring": "active",
        "alerting": "active",
        "logging": "active"
      }
    },
    "security": {
      "authentication": "active",
      "authorization": "active", 
      "rateLimiting": "active",
      "inputValidation": "active",
      "auditLogging": "active",
      "dataEncryption": "active"
    },
    "monitoring": {
      "alertSystem": {
        "totalAlerts": 10,
        "activeAlerts": 1,
        "resolvedAlerts": 9,
        "criticalAlerts": 0
      },
      "performance": {
        "avgResponseTime": "45ms",
        "requestCount": 5432,
        "errorRate": 0.02,
        "uptime": 99.98
      },
      "activeAlerts": [
        {
          "id": "alert-1",
          "type": "performance",
          "severity": "medium",
          "message": "Response time elevated",
          "timestamp": "2023-12-01T09:30:00.000Z"
        }
      ]
    },
    "diagnostics": [
      {
        "type": "info",
        "category": "uptime",
        "message": "Long uptime: 24 hours",
        "recommendation": "Consider scheduled restarts for optimal performance"
      }
    ],
    "recommendations": [
      {
        "priority": "medium",
        "category": "performance",
        "title": "Optimize Database Queries",
        "description": "Some queries taking longer than expected",
        "action": "Review slow query log and add indexes where needed"
      }
    ]
  }
}
```

---

### POST /api/health/test

**Headers:** `Authorization: Bearer <admin_token>`

Test all monitoring systems.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "alertSystem": true,
    "monitoring": true,
    "logging": true,
    "database": true,
    "errors": [],
    "overallStatus": "passed",
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

---

### GET /api/monitoring/metrics

**Headers:** `Authorization: Bearer <admin_token>`

Get comprehensive database metrics.

**Query Parameters:**
- `refresh` (optional): Force refresh cache ("true"/"false")

**Response (200):**
```json
{
  "success": true,
  "data": {
    "performance": {
      "avgQueryTime": "2.3ms",
      "totalQueries": 15430,
      "slowQueries": 23,
      "cacheHitRate": 95.2
    },
    "storage": {
      "databaseSize": "45MB",
      "indexSize": "12MB",
      "freeSpace": "2GB"
    },
    "connections": {
      "active": 3,
      "idle": 7,
      "maxConnections": 10
    },
    "tables": {
      "service_logs": {
        "recordCount": 1234,
        "size": "15MB",
        "lastOptimized": "2023-12-01T08:00:00.000Z"
      },
      "users": {
        "recordCount": 25,
        "size": "1MB", 
        "lastOptimized": "2023-12-01T08:00:00.000Z"
      }
    },
    "timestamp": "2023-12-01T10:00:00.000Z",
    "cached": false
  }
}
```

---

### GET /api/monitoring/recommendations

**Headers:** `Authorization: Bearer <admin_token>`

Get optimization recommendations.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "index_service_logs_date",
        "category": "performance",
        "priority": "high",
        "title": "Add Index on Service Date",
        "description": "Queries filtering by service_date are slow",
        "impact": "Improve query performance by 60%",
        "effort": "low",
        "sql": "CREATE INDEX idx_service_logs_service_date ON service_logs(service_date)"
      },
      {
        "id": "optimize_patient_entries",
        "category": "maintenance",
        "priority": "medium",
        "title": "Optimize Patient Entries Table",
        "description": "Table fragmentation detected",
        "impact": "Reduce storage size and improve performance",
        "effort": "medium",
        "action": "Run VACUUM on patient_entries table"
      }
    ],
    "totalCount": 2,
    "highPriority": 1,
    "mediumPriority": 1,
    "lowPriority": 0
  }
}
```

---

### GET /api/monitoring/health

**Headers:** `Authorization: Bearer <admin_token>`

Database health check.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "responseTime": "3ms",
    "connections": {
      "active": 3,
      "status": "normal"
    },
    "queryMetrics": {
      "totalQueries": 15430,
      "avgResponseTime": "2.3ms",
      "errorRate": 0.001
    },
    "integrity": {
      "status": "ok",
      "lastCheck": "2023-12-01T08:00:00.000Z"
    },
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

---

### POST /api/monitoring/optimize

**Headers:** `Authorization: Bearer <admin_token>`

Run database optimization.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Database optimization completed successfully",
    "executionTime": 2500,
    "optimizations": [
      "VACUUM completed",
      "Index analysis completed",
      "Statistics updated"
    ],
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

---

### GET /api/monitoring/migrations

**Headers:** `Authorization: Bearer <admin_token>`

Get migration status.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "migrations": [
      {
        "id": "001_initial_schema",
        "filename": "001_initial_schema.sql",
        "applied": true,
        "appliedAt": "2023-11-01T10:00:00.000Z"
      },
      {
        "id": "002_add_indexes",
        "filename": "002_add_indexes.sql", 
        "applied": true,
        "appliedAt": "2023-11-15T09:00:00.000Z"
      }
    ],
    "totalMigrations": 2,
    "appliedMigrations": 2,
    "pendingMigrations": 0
  }
}
```

---

### POST /api/monitoring/migrations/run

**Headers:** `Authorization: Bearer <admin_token>`

Run pending migrations.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Database migrations completed successfully",
    "appliedMigrations": 0,
    "executionTime": 150,
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

---

## Client Error Logging Endpoints

### POST /api/client-logs

Batch client error reporting (authentication optional).

**Request Body:**
```json
{
  "errors": [
    {
      "id": "error-uuid-1",
      "timestamp": "2023-12-01T10:00:00.000Z",
      "error": {
        "name": "ValidationError",
        "message": "Required field missing: client selection"
      },
      "context": {
        "level": "high",
        "category": "validation",
        "page": "/service-logs/new",
        "component": "ServiceLogForm"
      },
      "healthcareContext": {
        "hasPatientData": false,
        "activeForm": "service-log",
        "dataType": "form_validation"
      },
      "environment": {
        "viewport": "1920x1080",
        "userAgent": "Mozilla/5.0...",
        "url": "http://localhost:3000/service-logs/new"
      },
      "recovery": {
        "attempted": true,
        "successful": false,
        "action": "form_validation_retry"
      }
    }
  ],
  "interactions": [
    {
      "event": "form_submit_attempt",
      "timestamp": "2023-12-01T09:59:58.000Z",
      "context": {
        "page": "/service-logs/new",
        "component": "ServiceLogForm"
      },
      "data": {
        "formValid": false,
        "missingFields": ["clientId"]
      }
    }
  ],
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

**Validation Rules:**
- `error.context.level`: "low", "medium", "high", or "critical"
- `error.context.category`: "ui", "network", "validation", "security", or "healthcare"
- `error.message`: Maximum 1000 characters
- `interactions`: Optional array of user interaction events

**Response (200):**
```json
{
  "success": true,
  "data": {
    "processedErrors": 1,
    "processedInteractions": 1,
    "criticalErrors": 0,
    "securityEvents": 0,
    "healthcareIssues": 0,
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

---

### POST /api/client-logs/critical

Immediate critical error reporting.

**Request Body:**
```json
{
  "error": {
    "id": "critical-error-uuid",
    "timestamp": "2023-12-01T10:00:00.000Z",
    "error": {
      "name": "SecurityError",
      "message": "Unauthorized access attempt detected"
    },
    "context": {
      "level": "critical",
      "category": "security",
      "page": "/admin/users",
      "component": "UserManagement"
    },
    "healthcareContext": {
      "hasPatientData": true,
      "activeForm": "patient_data",
      "dataType": "security_violation"
    },
    "environment": {
      "viewport": "1920x1080",
      "userAgent": "Mozilla/5.0..."
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "processed": true,
    "errorId": "critical-error-uuid",
    "alertSent": true,
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

**Rate Limits:**
- Standard errors: 50 per 5 minutes
- Critical errors: 10 per 1 minute (bypass standard rate limits)

---

### GET /api/client-logs/statistics

**Headers:** `Authorization: Bearer <token>`

Get client error statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "last24Hours": {
      "totalErrors": 145,
      "criticalErrors": 3,
      "errorsByCategory": {
        "ui": 89,
        "network": 23,
        "validation": 28,
        "security": 3,
        "healthcare": 2
      },
      "topErrors": [
        {
          "message": "Network request failed",
          "count": 45,
          "category": "network"
        }
      ],
      "affectedUsers": 12
    },
    "trends": {
      "errorRate": "increasing",
      "criticalTrend": "stable",
      "mostProblematicPage": "/service-logs/new"
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

## Data Models

### User

```typescript
interface User {
  readonly id: string; // UUID
  username: string;
  email: string;
  role: 'admin' | 'candidate';
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt?: string; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Service Log

```typescript
interface ServiceLog {
  readonly id: string; // UUID
  userId: string; // UUID reference
  clientId: string; // Client ID as string
  activityId: string; // Activity ID as string
  serviceDate: string; // YYYY-MM-DD format
  patientCount: number; // 1-100
  isDraft: boolean;
  submittedAt?: string; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Patient Entry

```typescript
interface PatientEntry {
  readonly id: string; // UUID
  serviceLogId: string; // UUID reference
  appointmentType: 'new' | 'followup' | 'dna';
  outcomeId: string; // Outcome ID as string
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Client

```typescript
interface Client {
  readonly id: string; // String ID
  name: string; // 2-100 characters
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Activity

```typescript
interface Activity {
  readonly id: string; // String ID
  name: string; // 2-100 characters
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Outcome

```typescript
interface Outcome {
  readonly id: string; // String ID
  name: string; // 2-100 characters
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Server Configuration
NODE_ENV=development # development | production | test
PORT=3001 # Default: 3001

# Database Configuration
DB_PATH=./healthcare_portal.db # SQLite database path
AUDIT_DB_PATH=./audit.db # Audit log database path

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-here

# CORS Configuration
CORS_ORIGIN=http://localhost:3000 # Comma-separated for multiple origins

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000 # Rate limit window (15 minutes)
RATE_LIMIT_MAX=100 # Max requests per window (production)

# Logging Configuration
LOG_LEVEL=info # error | warn | info | debug
LOG_FORMAT=combined # combined | common | dev

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000 # Health check interval (30 seconds)
ALERT_THRESHOLD_RESPONSE_TIME=1000 # Alert if response time > 1s
ALERT_THRESHOLD_ERROR_RATE=0.05 # Alert if error rate > 5%

# HIPAA Compliance
HIPAA_AUDIT_ENABLED=true # Enable HIPAA audit logging
PHI_ENCRYPTION_ENABLED=true # Enable PHI encryption
```

### Optional Environment Variables

```bash
# Monitoring Configuration  
MONITORING_ENABLED=true # Enable application monitoring
METRICS_COLLECTION_INTERVAL=60000 # Metrics collection interval

# Email/Alert Configuration (if implementing notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASS=your-email-password
ALERT_EMAIL_TO=admin@yourdomain.com

# External Service Configuration
EXTERNAL_API_BASE_URL=https://api.external-service.com
EXTERNAL_API_KEY=your-external-api-key

# Performance Configuration
DB_POOL_SIZE=10 # Database connection pool size
REQUEST_TIMEOUT=30000 # Request timeout (30 seconds)
CACHE_TTL=300000 # Cache TTL (5 minutes)
```

---

## Development Setup

### Prerequisites

- Node.js 18.17.0 or higher
- npm 9.0.0 or higher
- SQLite 3.x

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd healthcare-portal
```

2. **Install dependencies:**
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies  
cd ../frontend
npm install
```

3. **Environment setup:**
```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your configuration

# Frontend environment
cd ../frontend  
cp .env.example .env
# Edit .env with backend API URL
```

4. **Database initialization:**
```bash
cd backend
npm run db:migrate
npm run db:seed # Optional: seed with sample data
```

5. **Start development servers:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev # Starts on port 3001

# Terminal 2 - Frontend
cd frontend  
npm run dev # Starts on port 3000
```

### Development Scripts

```bash
# Backend
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm test            # Run test suite
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint        # Run ESLint
npm run format      # Format code with Prettier
npm run db:migrate  # Run database migrations
npm run db:seed     # Seed database with sample data
npm run db:reset    # Reset database

# Frontend
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm test           # Run test suite
npm run test:ui    # Run tests with UI
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
```

### Testing

#### Backend Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:api        # API endpoint tests only

# Run tests with specific patterns
npm test -- --testPathPattern=auth
npm test -- --testNamePattern="should authenticate user"

# Debug tests
npm run test:debug

# Coverage reporting
npm run test:coverage
```

#### Frontend Tests

```bash
# Run all tests
npm test

# Run component tests
npm run test:components

# Run E2E tests
npm run test:e2e

# Interactive test UI
npm run test:ui
```

### Database Management

#### Migrations

```bash
# Check migration status
npm run db:status

# Run pending migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Create new migration
npm run db:migration:create -- --name add_new_field
```

#### Seeding

```bash
# Seed development data
npm run db:seed

# Seed specific data
npm run db:seed -- --type users
npm run db:seed -- --type service-logs

# Clear and reseed
npm run db:seed:fresh
```

---

## Production Deployment

### Build Process

```bash
# Build backend
cd backend
npm run build
npm run test:production # Run production test suite

# Build frontend
cd frontend
npm run build
npm run test:e2e:production # Run E2E tests against production build
```

### Production Environment

#### Environment Variables

```bash
NODE_ENV=production
PORT=3001
DB_PATH=/var/lib/healthcare-portal/production.db
AUDIT_DB_PATH=/var/lib/healthcare-portal/audit.db
JWT_SECRET=<strong-production-secret>
JWT_REFRESH_SECRET=<strong-production-refresh-secret>
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_MAX=100
HIPAA_AUDIT_ENABLED=true
PHI_ENCRYPTION_ENABLED=true
```

#### Production Checklist

- [ ] Strong JWT secrets configured
- [ ] HTTPS enabled with valid SSL certificate
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled with production limits
- [ ] Database backed up and secured
- [ ] Audit logging enabled and monitored
- [ ] Health checks configured
- [ ] Error monitoring setup (e.g., Sentry)
- [ ] Log aggregation configured (e.g., ELK stack)
- [ ] Security headers configured
- [ ] Content Security Policy implemented
- [ ] Regular security scans scheduled

#### Docker Deployment

```dockerfile
# Dockerfile.backend
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY public/ ./public/

EXPOSE 3001

CMD ["npm", "start"]
```

```dockerfile
# Dockerfile.frontend
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/production.db
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./data:/app/data
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - frontend
```

### Monitoring & Alerts

#### Health Check Monitoring

```bash
# Check application health
curl https://yourdomain.com/api/health

# Detailed health check (requires admin token)
curl -H "Authorization: Bearer <admin_token>" \
     https://yourdomain.com/api/health/detailed
```

#### Log Monitoring

```bash
# Application logs
tail -f /var/log/healthcare-portal/app.log

# Audit logs
tail -f /var/log/healthcare-portal/audit.log

# Error logs
tail -f /var/log/healthcare-portal/error.log
```

#### Performance Monitoring

```bash
# System metrics
curl -H "Authorization: Bearer <admin_token>" \
     https://yourdomain.com/api/monitoring/metrics

# Database optimization recommendations
curl -H "Authorization: Bearer <admin_token>" \
     https://yourdomain.com/api/monitoring/recommendations
```

---

## Security Considerations

### HIPAA Compliance

#### Data Protection
- **Encryption**: All PHI encrypted at rest and in transit
- **Access Controls**: Role-based access with audit logging
- **Audit Trails**: All data access and modifications logged
- **Data Retention**: Automated deletion of logs per retention policy
- **Breach Notification**: Automated alerts for security incidents

#### Technical Safeguards
- **Authentication**: Multi-factor authentication recommended
- **Authorization**: Principle of least privilege
- **Audit Logging**: Tamper-evident audit logs
- **Data Integrity**: Checksums and validation
- **Transmission Security**: HTTPS/TLS 1.3 required

#### Administrative Safeguards
- **Security Officer**: Designated security responsible party
- **Workforce Training**: Regular security training required
- **Access Management**: Formal access request/termination process
- **Incident Response**: Documented breach response procedures
- **Risk Assessment**: Regular security assessments

### Security Headers

```http
# Production Security Headers
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Authentication Security

#### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Special characters recommended

#### Token Security
- JWT signed with HS256 algorithm
- Short-lived access tokens (15 minutes)
- Secure refresh token rotation
- Blacklist for revoked tokens
- Secure token storage (httpOnly cookies recommended)

### Input Validation

#### Request Validation
- All inputs validated using Zod schemas
- SQL injection prevention with parameterized queries
- XSS prevention with output encoding
- File upload restrictions and scanning
- Rate limiting per endpoint and user

#### Data Sanitization
- HTML sanitization for text inputs
- Email validation and normalization
- Phone number formatting and validation
- Date/time format validation
- Numeric range validation

### Network Security

#### HTTPS Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

#### Firewall Configuration
- Block all unnecessary ports
- Whitelist known IP addresses for admin access
- DDoS protection enabled
- Intrusion detection system configured
- Regular security scans scheduled

### Audit Logging

#### Logged Events
- User authentication attempts (success/failure)
- Data access and modifications
- Administrative actions
- Security events and alerts
- System configuration changes
- Error conditions and exceptions

#### Audit Log Format
```json
{
  "timestamp": "2023-12-01T10:00:00.000Z",
  "userId": "user-uuid",
  "action": "DATA_ACCESS",
  "resource": "service_logs",
  "resourceId": "log-uuid",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "success": true,
  "details": {
    "operation": "READ",
    "dataType": "healthcare_service_log"
  }
}
```

#### Audit Log Security
- Tamper-evident storage
- Encrypted at rest
- Backed up regularly
- Access restricted to security personnel
- Automatic alerting on access attempts
- Retention period compliance

---

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database file permissions
ls -la healthcare_portal.db

# Verify database schema
sqlite3 healthcare_portal.db ".schema"

# Check database integrity
sqlite3 healthcare_portal.db "PRAGMA integrity_check;"
```

#### Authentication Issues
```bash
# Verify JWT secret configuration
echo $JWT_SECRET

# Check token expiration
node -e "console.log(JSON.parse(Buffer.from('token-payload', 'base64').toString()))"

# Test authentication endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

#### CORS Issues
```bash
# Check CORS configuration
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3001/api/auth/login
```

#### Performance Issues
```bash
# Check system resources
npm run monitoring:metrics

# Database optimization
npm run db:optimize

# Check for slow queries
npm run db:analyze
```

### Error Codes Reference

| Code | Cause | Solution |
|------|-------|----------|
| `DB_CONNECTION_FAILED` | Database file missing or corrupted | Run `npm run db:migrate` |
| `JWT_SECRET_MISSING` | JWT_SECRET not configured | Set JWT_SECRET in environment |
| `CORS_ERROR` | Frontend origin not allowed | Update CORS_ORIGIN configuration |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait for rate limit reset or increase limits |
| `VALIDATION_ERROR` | Invalid request data | Check request format against API documentation |
| `AUTHENTICATION_FAILED` | Invalid credentials | Verify username/password or token validity |
| `AUTHORIZATION_FAILED` | Insufficient permissions | Check user role and endpoint requirements |

### Support Information

For technical support and bug reports, please contact:

- **Development Team**: dev@yourdomain.com
- **Security Issues**: security@yourdomain.com
- **Documentation**: docs@yourdomain.com

**Version**: 1.0.0  
**Last Updated**: December 1, 2023  
**Next Review**: January 1, 2024

---

*This API documentation follows healthcare industry standards and HIPAA compliance requirements. All endpoints implement proper security measures, audit logging, and error handling to ensure patient data protection and system reliability.*