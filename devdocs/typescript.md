# TypeScript Documentation for Healthcare Service Log Portal

## Overview
TypeScript provides static type checking for JavaScript, essential for building reliable healthcare applications with complex data structures and strict validation requirements.

## Core Types and Interfaces

### Basic Types
```typescript
// Healthcare domain types
type PatientId = string;
type ServiceType = 'consultation' | 'procedure' | 'therapy' | 'diagnostic';
type UserRole = 'admin' | 'provider' | 'staff';
type ServiceStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

// Date handling for healthcare records
type ISODateString = string; // ISO 8601 format
type Timestamp = number; // Unix timestamp
```

### Interface Definitions
```typescript
interface Patient {
  readonly id: PatientId;
  firstName: string;
  lastName: string;
  dateOfBirth: ISODateString;
  phone: string;
  email?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

interface ServiceEntry {
  readonly id: string;
  patientId: PatientId;
  serviceType: ServiceType;
  providerId: string;
  scheduledDate: ISODateString;
  duration: number; // minutes
  status: ServiceStatus;
  notes?: string;
  billing?: {
    code: string;
    amount: number;
    insurance?: string;
  };
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

interface User {
  readonly id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  profile: {
    firstName: string;
    lastName: string;
    department?: string;
    licenseNumber?: string;
  };
  isActive: boolean;
  lastLoginAt?: ISODateString;
}

interface Permission {
  resource: 'patients' | 'services' | 'users' | 'reports';
  actions: ('create' | 'read' | 'update' | 'delete')[];
}
```

## Advanced Types

### Union and Discriminated Unions
```typescript
// API Response types with discriminated unions
type ApiResponse<T> = 
  | { success: true; data: T; timestamp: ISODateString }
  | { success: false; error: ErrorDetails; timestamp: ISODateString };

interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Form validation results
type ValidationResult = 
  | { valid: true; value: string }
  | { valid: false; errors: string[] };

// Service log entry creation with different states
type ServiceEntryDraft = Omit<ServiceEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
  status: 'draft';
};

type ServiceEntryScheduled = ServiceEntry & {
  status: 'scheduled';
  scheduledDate: ISODateString;
};
```

### Generic Types
```typescript
// Generic API client
interface ApiClient {
  get<T>(endpoint: string): Promise<ApiResponse<T>>;
  post<T, U>(endpoint: string, data: T): Promise<ApiResponse<U>>;
  put<T, U>(endpoint: string, data: T): Promise<ApiResponse<U>>;
  delete(endpoint: string): Promise<ApiResponse<void>>;
}

// Generic form state management
interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Generic data repository pattern
interface Repository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findAll(filters?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: K, data: Partial<T>): Promise<T>;
  delete(id: K): Promise<void>;
}

// Usage examples
type PatientRepository = Repository<Patient, PatientId>;
type ServiceRepository = Repository<ServiceEntry>;
```

### Utility Types
```typescript
// Extract specific properties for API payloads
type PatientCreateRequest = Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>;
type PatientUpdateRequest = Partial<Pick<Patient, 'firstName' | 'lastName' | 'phone' | 'email'>>;

// Make certain fields optional for form handling
type PatientFormData = Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> & {
  email: string; // Make email required in forms
};

// Extract union type members
type ServiceTypeOptions = {
  [K in ServiceType]: {
    value: K;
    label: string;
    description: string;
    defaultDuration: number;
  };
};

// Create lookup types
type PatientLookup = Record<PatientId, Patient>;
type ServicesByPatient = Record<PatientId, ServiceEntry[]>;

// Conditional types for role-based access
type AdminOnlyFields<T> = T extends { role: 'admin' } ? T : Omit<T, 'permissions'>;
```

## Function Types and Signatures

### Event Handlers
```typescript
// Form event handlers
type FormSubmitHandler<T> = (data: T) => Promise<void> | void;
type FormChangeHandler<T> = (field: keyof T, value: T[keyof T]) => void;
type FormValidationHandler<T> = (data: T) => ValidationResult;

// React component prop types
interface PatientFormProps {
  patient?: Patient;
  onSubmit: FormSubmitHandler<PatientCreateRequest>;
  onChange?: FormChangeHandler<PatientFormData>;
  onValidate?: FormValidationHandler<PatientFormData>;
  isLoading?: boolean;
}

// API service types
interface PatientService {
  getPatients(filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ patients: Patient[]; total: number }>>;
  
  getPatient(id: PatientId): Promise<ApiResponse<Patient>>;
  createPatient(data: PatientCreateRequest): Promise<ApiResponse<Patient>>;
  updatePatient(id: PatientId, data: PatientUpdateRequest): Promise<ApiResponse<Patient>>;
  deletePatient(id: PatientId): Promise<ApiResponse<void>>;
}
```

### Higher-Order Functions
```typescript
// Generic validation function
function createValidator<T>(
  schema: Record<keyof T, (value: T[keyof T]) => string | null>
): (data: T) => Record<keyof T, string | null> {
  return (data: T) => {
    const errors = {} as Record<keyof T, string | null>;
    
    for (const field in schema) {
      errors[field] = schema[field](data[field]);
    }
    
    return errors;
  };
}

// Usage
const validatePatient = createValidator<PatientCreateRequest>({
  firstName: (value) => value?.length < 2 ? 'Name too short' : null,
  lastName: (value) => value?.length < 2 ? 'Name too short' : null,
  phone: (value) => !/^\d{10}$/.test(value) ? 'Invalid phone' : null,
  email: (value) => value && !value.includes('@') ? 'Invalid email' : null,
});
```

## Type Guards and Narrowing

### Custom Type Guards
```typescript
// Type guards for runtime validation
function isPatient(obj: unknown): obj is Patient {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Patient).id === 'string' &&
    typeof (obj as Patient).firstName === 'string' &&
    typeof (obj as Patient).lastName === 'string'
  );
}

function isValidServiceType(value: string): value is ServiceType {
  return ['consultation', 'procedure', 'therapy', 'diagnostic'].includes(value);
}

// API response type guard
function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true } {
  return response.success === true;
}

// Usage in error handling
async function fetchPatient(id: PatientId): Promise<Patient | null> {
  const response = await apiClient.get<Patient>(`/patients/${id}`);
  
  if (isSuccessResponse(response)) {
    return response.data;
  }
  
  console.error('Failed to fetch patient:', response.error);
  return null;
}
```

### Discriminated Union Narrowing
```typescript
function handleApiResponse<T>(response: ApiResponse<T>): T | never {
  if (response.success) {
    // TypeScript knows this is success case
    return response.data;
  } else {
    // TypeScript knows this is error case
    throw new Error(`API Error: ${response.error.message}`);
  }
}
```

## Configuration Types

### TypeScript Configuration
```typescript
// tsconfig.json type definitions
interface TSConfig {
  compilerOptions: {
    target: 'ES2022';
    lib: ['ES2022', 'DOM', 'DOM.Iterable'];
    allowJs: boolean;
    skipLibCheck: boolean;
    esModuleInterop: boolean;
    allowSyntheticDefaultImports: boolean;
    strict: boolean;
    forceConsistentCasingInFileNames: boolean;
    moduleResolution: 'node';
    resolveJsonModule: boolean;
    isolatedModules: boolean;
    noEmit: boolean;
    jsx: 'react-jsx';
    types: ['jest', '@testing-library/jest-dom'];
  };
  include: string[];
  exclude: string[];
}

// Environment configuration
interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  API_BASE_URL: string;
  JWT_SECRET: string;
  DB_PATH: string;
  PORT: number;
  CORS_ORIGIN: string[];
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvironmentConfig {}
  }
}
```

## Testing Types

### Jest and Testing Library Types
```typescript
// Mock types for testing
interface MockApiClient extends jest.Mocked<ApiClient> {}

interface TestPatient extends Patient {
  _isTestData: true;
}

// Test utility types
type PatientFactory = (overrides?: Partial<Patient>) => Patient;
type ServiceFactory = (patientId: PatientId, overrides?: Partial<ServiceEntry>) => ServiceEntry;

// Component testing props
interface TestWrapperProps {
  children: React.ReactNode;
  initialState?: {
    user?: User;
    patients?: Patient[];
  };
}

// Custom render function type
type CustomRender = (
  ui: React.ReactElement,
  options?: {
    initialEntries?: string[];
    initialState?: TestWrapperProps['initialState'];
  }
) => ReturnType<typeof render>;
```

## Best Practices for Healthcare Applications

### 1. Strict Type Checking
```typescript
// Enable strict mode in tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 2. Immutable Data Patterns
```typescript
// Use readonly for data integrity
interface ReadonlyPatient extends Readonly<Patient> {
  readonly emergencyContact: Readonly<Patient['emergencyContact']>;
}

// Immutable update helpers
function updatePatient<K extends keyof Patient>(
  patient: Patient,
  field: K,
  value: Patient[K]
): Patient {
  return {
    ...patient,
    [field]: value,
    updatedAt: new Date().toISOString()
  };
}
```

### 3. Error Handling Types
```typescript
// Result type pattern
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

async function safeApiCall<T>(
  operation: () => Promise<T>
): Promise<Result<T, string>> {
  try {
    const value = await operation();
    return { ok: true, value };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### 4. Branded Types for Domain Safety
```typescript
// Prevent mixing different ID types
type Brand<T, K> = T & { __brand: K };

type PatientId = Brand<string, 'PatientId'>;
type ServiceId = Brand<string, 'ServiceId'>;
type UserId = Brand<string, 'UserId'>;

// Factory functions for branded types
function createPatientId(value: string): PatientId {
  // Add validation logic here
  return value as PatientId;
}

// This prevents accidental mixing of IDs
function getPatient(id: PatientId) { /* ... */ }
function getService(id: ServiceId) { /* ... */ }

// getPatient(serviceId); // TypeScript error!
```

### 5. Module Augmentation for Libraries
```typescript
// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      patientId?: PatientId;
    }
  }
}

// Extend process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      JWT_SECRET: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}
```

## Common Patterns

### Repository Pattern with Types
```typescript
abstract class BaseRepository<T, K extends string | number = string> {
  abstract findById(id: K): Promise<T | null>;
  abstract findAll(filters?: Partial<T>): Promise<T[]>;
  abstract create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  abstract update(id: K, data: Partial<T>): Promise<T>;
  abstract delete(id: K): Promise<void>;
}

class PatientRepository extends BaseRepository<Patient, PatientId> {
  async findById(id: PatientId): Promise<Patient | null> {
    // Implementation
  }
  
  async findByPhone(phone: string): Promise<Patient | null> {
    // Additional method specific to patients
  }
}
```

### Service Layer Pattern
```typescript
interface ServiceDependencies {
  patientRepo: PatientRepository;
  serviceRepo: ServiceRepository;
  logger: Logger;
}

class PatientService {
  constructor(private deps: ServiceDependencies) {}

  async createPatient(data: PatientCreateRequest): Promise<Result<Patient, string>> {
    try {
      // Validation
      const validationErrors = await this.validatePatientData(data);
      if (validationErrors.length > 0) {
        return { ok: false, error: validationErrors.join(', ') };
      }

      const patient = await this.deps.patientRepo.create(data);
      this.deps.logger.info('Patient created', { patientId: patient.id });
      
      return { ok: true, value: patient };
    } catch (error) {
      this.deps.logger.error('Failed to create patient', { error, data });
      return { ok: false, error: 'Failed to create patient' };
    }
  }

  private async validatePatientData(data: PatientCreateRequest): Promise<string[]> {
    const errors: string[] = [];
    
    // Check for duplicate phone
    const existingPatient = await this.deps.patientRepo.findByPhone(data.phone);
    if (existingPatient) {
      errors.push('Phone number already in use');
    }

    return errors;
  }
}
```

## Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [Advanced TypeScript Patterns](https://www.typescriptlang.org/docs/handbook/advanced-types.html)