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

// Healthcare Service Log Types - Following documented patterns

// Service log domain types
export type ServiceLogId = string;
export type PatientEntryId = string;
export type ClientId = number;
export type ActivityId = number;
export type OutcomeId = number;
export type CustomFieldId = number;
export type FieldChoiceId = number;

// Healthcare domain interfaces
export interface Client {
  readonly id: ClientId;
  name: string;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Activity {
  readonly id: ActivityId;
  name: string;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Outcome {
  readonly id: OutcomeId;
  name: string;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Main service log entity
export interface ServiceLog {
  readonly id: ServiceLogId;
  userId: UserId;
  clientId: ClientId;
  activityId: ActivityId;
  serviceDate: string; // Phase 3.5: Added service date field
  patientCount: number;
  isDraft: boolean;
  submittedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Patient entry details - Phase 3.5: Appointment-based structure
export type AppointmentType = 'new' | 'followup' | 'dna';

export interface PatientEntry {
  readonly id: PatientEntryId;
  serviceLogId: ServiceLogId;
  appointmentType: AppointmentType; // Phase 3.5: Single appointment per entry
  outcomeId: OutcomeId; // Phase 3.5: Made required
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Dynamic field system
export type FieldType = 'dropdown' | 'text' | 'number' | 'checkbox';

export interface CustomField {
  readonly id: CustomFieldId;
  fieldLabel: string;
  fieldType: FieldType;
  fieldOrder: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface FieldChoice {
  readonly id: FieldChoiceId;
  fieldId: CustomFieldId;
  choiceText: string;
  choiceOrder: number;
  createdAt: ISODateString;
}

export interface CustomFieldValue {
  readonly id: string;
  patientEntryId: PatientEntryId;
  fieldId: CustomFieldId;
  choiceId?: FieldChoiceId;
  textValue?: string;
  numberValue?: number;
  checkboxValue?: boolean;
  createdAt: ISODateString;
}

// Database row types (following documented patterns)
export interface DatabaseServiceLog {
  id: string;
  user_id: string;
  client_id: number;
  activity_id: number;
  service_date: string; // Phase 3.5: Added service date field
  patient_count: number;
  is_draft: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabasePatientEntry {
  id: string;
  service_log_id: string;
  appointment_type: string; // Phase 3.5: Appointment-based structure
  outcome_id: number; // Phase 3.5: Made required
  created_at: string;
  updated_at: string;
}

export interface DatabaseClient {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseActivity {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOutcome {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseCustomField {
  id: number;
  field_label: string;
  field_type: string;
  field_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseFieldChoice {
  id: number;
  field_id: number;
  choice_text: string;
  choice_order: number;
  created_at: string;
}

export interface DatabaseCustomFieldValue {
  id: string;
  patient_entry_id: string;
  field_id: number;
  choice_id: number | null;
  text_value: string | null;
  number_value: number | null;
  checkbox_value: number | null;
  created_at: string;
}

// Request/Response types for API
export type ServiceLogCreateRequest = Omit<ServiceLog, 'id' | 'createdAt' | 'updatedAt' | 'submittedAt'> & {
  patientEntries: Array<Omit<PatientEntry, 'id' | 'serviceLogId' | 'createdAt' | 'updatedAt'>>;
};

export type ServiceLogUpdateRequest = Partial<Pick<ServiceLog, 'clientId' | 'activityId' | 'patientCount' | 'isDraft'>>;

export type ClientCreateRequest = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
export type ActivityCreateRequest = Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>;
export type OutcomeCreateRequest = Omit<Outcome, 'id' | 'createdAt' | 'updatedAt'>;

export type CustomFieldCreateRequest = Omit<CustomField, 'id' | 'createdAt' | 'updatedAt'> & {
  choices?: Array<Omit<FieldChoice, 'id' | 'fieldId' | 'createdAt'>>;
};

// Extended service log with related data
export interface ServiceLogWithDetails extends ServiceLog {
  client?: Client;
  activity?: Activity;
  user?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  patientEntries: Array<PatientEntry & {
    outcome?: Outcome;
    customFieldValues?: CustomFieldValue[];
  }>;
}

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter types for service logs
export interface ServiceLogFilters {
  userId?: UserId;
  clientId?: ClientId;
  activityId?: ActivityId;
  isDraft?: boolean;
  startDate?: ISODateString;
  endDate?: ISODateString;
}

// Audit log types
export interface AuditLogEntry {
  readonly id: number;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  userId: UserId;
  timestamp: ISODateString;
}

export interface DatabaseAuditLog {
  id: number;
  table_name: string;
  record_id: string;
  action: string;
  old_values: string | null;
  new_values: string | null;
  user_id: string;
  timestamp: string;
}

// Repository types for healthcare entities
export type ServiceLogRepository = Repository<ServiceLog, ServiceLogId>;
export type PatientEntryRepository = Repository<PatientEntry, PatientEntryId>;
export type ClientRepository = Repository<Client, ClientId>;
export type ActivityRepository = Repository<Activity, ActivityId>;
export type OutcomeRepository = Repository<Outcome, OutcomeId>;
export type CustomFieldRepository = Repository<CustomField, CustomFieldId>;

// Service dependencies extended for healthcare
export interface HealthcareServiceDependencies extends ServiceDependencies {
  serviceLogRepo: ServiceLogRepository;
  patientEntryRepo: PatientEntryRepository;
  clientRepo: ClientRepository;
  activityRepo: ActivityRepository;
  outcomeRepo: OutcomeRepository;
  customFieldRepo: CustomFieldRepository;
}