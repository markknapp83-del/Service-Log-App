# Healthcare Service Log Portal - Development Plan

## Executive Summary
A web-based portal for healthcare workers to log patient services with dynamic form capabilities and comprehensive admin management. Built using Test-Driven Development (TDD) with a focus on simplicity, reliability, and user experience.

**🚨 CRITICAL: ALL development must reference the comprehensive documentation in `/devdocs/` before writing any code. This plan integrates patterns from the documented healthcare-specific implementations.**

## Tech Stack
**All technologies below have comprehensive documentation in `/devdocs/` that MUST be consulted:**
- **Backend**: Node.js with Express.js → [Express.js Documentation](./devdocs/express.md)
- **Database**: SQLite with better-sqlite3 → [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)
- **Frontend**: React 18 with TypeScript → [React 18](./devdocs/react-18.md) + [TypeScript](./devdocs/typescript.md)
- **UI Framework**: Tailwind CSS + shadcn/ui → [Tailwind CSS](./devdocs/tailwind.md) + [shadcn/ui](./devdocs/shadcn-ui.md)
- **Form Management**: React Hook Form + Zod → [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md)
- **Authentication**: JWT with bcrypt
- **Testing**: Jest + React Testing Library + Playwright → [Jest](./devdocs/jest.md) + [React Testing Library](./devdocs/react-testing-library.md)
- **Build Tools**: Vite for frontend, tsx for backend development

**📚 Documentation-First Development**: Check [Documentation Index](./devdocs/index.md) for relevant patterns before implementing any feature.

## UI/UX Design Principles
**🚨 FOLLOW DOCUMENTED PATTERNS ONLY - DO NOT CREATE CUSTOM IMPLEMENTATIONS**

- **Design System** ([Tailwind CSS Documentation](./devdocs/tailwind.md) + [shadcn/ui Documentation](./devdocs/shadcn-ui.md)): 
  - Use documented healthcare color palette and component patterns
  - Copy card layouts and spacing from shadcn/ui documentation
  - Follow documented responsive design patterns
  - Implement documented typography scale and hierarchy
  
- **User Experience** ([React 18 Documentation](./devdocs/react-18.md)):
  - Use documented progressive disclosure patterns
  - Implement documented validation patterns from [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md)
  - Copy auto-save patterns from React Hook Form documentation
  - Use documented loading states and error boundaries
  - Follow documented accessibility patterns (WCAG 2.1 AA)
  - Implement documented keyboard navigation from shadcn/ui
  
- **Mobile-First Responsive Design** ([Tailwind CSS Documentation](./devdocs/tailwind.md)):
  - Use documented responsive breakpoint patterns
  - Follow documented touch target specifications
  - Copy documented mobile navigation patterns
  - Use documented form layout optimizations

**📖 Reference First**: Always check the relevant documentation file before implementing any UI/UX pattern.

## Project Structure
**📚 Each directory follows patterns documented in `/devdocs/`**
```
healthcare-portal/
├── devdocs/                    # 🚨 MANDATORY: Comprehensive tech documentation
│   ├── index.md               # Documentation index - CHECK FIRST
│   ├── react-18.md            # React patterns - frontend development
│   ├── express.md             # Express patterns - backend APIs
│   ├── typescript.md          # TypeScript patterns - type safety
│   ├── sqlite-better-sqlite3.md # Database patterns
│   ├── react-hook-form.md     # Form patterns
│   ├── zod.md                 # Validation patterns
│   ├── tailwind.md            # CSS patterns
│   ├── shadcn-ui.md           # Component patterns
│   ├── jest.md                # Testing patterns
│   └── react-testing-library.md # Component testing
├── backend/                    # Express.js patterns → ./devdocs/express.md
│   ├── src/
│   │   ├── controllers/       # API controllers with documented patterns
│   │   ├── models/            # Database models → ./devdocs/sqlite-better-sqlite3.md
│   │   ├── routes/            # RESTful routes with documented middleware
│   │   ├── middleware/        # Auth, validation, error handling patterns
│   │   ├── services/          # Business logic with documented patterns
│   │   └── utils/             # Utility functions with TypeScript patterns
│   ├── tests/                 # Jest testing → ./devdocs/jest.md
│   └── database/              # SQLite schema → ./devdocs/sqlite-better-sqlite3.md
├── frontend/                   # React 18 patterns → ./devdocs/react-18.md
│   ├── src/
│   │   ├── components/        # shadcn/ui components → ./devdocs/shadcn-ui.md
│   │   ├── pages/             # Route components with documented patterns
│   │   ├── hooks/             # Custom hooks → ./devdocs/react-18.md
│   │   ├── services/          # API services with TypeScript
│   │   ├── utils/             # Frontend utilities → ./devdocs/typescript.md
│   │   └── types/             # TypeScript definitions → ./devdocs/typescript.md
│   └── tests/                 # Component tests → ./devdocs/react-testing-library.md
└── e2e-tests/                  # End-to-end tests with Playwright
```

**🎯 Development Rule**: Never create files without first consulting the relevant documentation pattern.

---

## Phase 1: Foundation & Authentication (Week 1)
**📚 PRIMARY DOCUMENTATION**: [Express.js](./devdocs/express.md) + [TypeScript](./devdocs/typescript.md) + [Jest](./devdocs/jest.md)

### Objectives
Establish project foundation with authentication system and basic routing using documented healthcare-specific patterns.

### 🚨 MANDATORY Pre-Phase Steps
1. **Read [Express.js Documentation](./devdocs/express.md)** - Authentication middleware patterns
2. **Review [TypeScript Documentation](./devdocs/typescript.md)** - User interface definitions
3. **Study [Jest Documentation](./devdocs/jest.md)** - Authentication testing patterns
4. **Copy documented examples** rather than creating custom implementations

### Pre-Phase Test Specifications
**📖 Follow patterns from [Jest Documentation](./devdocs/jest.md)**

#### Unit Tests (backend/tests/auth.test.ts)
**Copy authentication testing patterns from Jest documentation:**
```typescript
describe('Authentication Service', () => {
  test('should hash passwords securely')
  test('should generate valid JWT tokens')
  test('should validate JWT tokens correctly')
  test('should reject expired tokens')
  test('should differentiate admin and candidate roles')
})

describe('User Model', () => {
  test('should create user with valid data')
  test('should reject duplicate emails')
  test('should validate email format')
  test('should enforce password complexity')
})
```

#### Integration Tests (backend/tests/auth.integration.test.ts)
```typescript
describe('Auth Endpoints', () => {
  test('POST /api/auth/login - successful login')
  test('POST /api/auth/login - invalid credentials')
  test('POST /api/auth/logout - clear session')
  test('POST /api/auth/reset-password - send reset email')
  test('GET /api/auth/verify - validate token')
})
```

#### Component Tests (frontend/tests/Login.test.tsx)
```typescript
describe('Login Component', () => {
  test('renders login form with email and password fields')
  test('shows validation errors for invalid input')
  test('disables submit during loading')
  test('redirects on successful login')
  test('displays error message on failed login')
})
```

### Deliverables
**🚨 Each deliverable MUST follow documented patterns:**
1. **Express server** → Copy setup patterns from [Express.js Documentation](./devdocs/express.md)
2. **SQLite database** → Use migration patterns from [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)
3. **Authentication endpoints** → Copy JWT middleware from Express.js documentation
4. **Protected routes** → Use documented authentication patterns
5. **React app setup** → Follow routing patterns from [React 18 Documentation](./devdocs/react-18.md)
6. **Login/logout pages** → Copy form patterns from [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md)
7. **Protected route wrapper** → Use documented React route protection patterns
8. **Session management** → Follow documented JWT refresh token patterns

**📖 Implementation Rule**: Find the relevant documentation example first, then copy and adapt the healthcare-specific implementation.

### Success Criteria
- All authentication tests pass
- Users can login/logout successfully
- JWT tokens expire and refresh properly
- Role-based routing works correctly

---

## Phase 2: Database Schema & Core Models (Week 2)
**📚 PRIMARY DOCUMENTATION**: [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md) + [TypeScript Documentation](./devdocs/typescript.md)

### Objectives
Design and implement complete database schema using documented healthcare data patterns and repository patterns.

### 🚨 MANDATORY Pre-Phase Steps
1. **Read [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)** - Healthcare table designs and repository patterns
2. **Study [TypeScript Documentation](./devdocs/typescript.md)** - Patient, Service, User interface definitions
3. **Review [Jest Documentation](./devdocs/jest.md)** - Database testing patterns
4. **Copy documented schema examples** for medical data structures

### Pre-Phase Test Specifications
**📖 Follow database testing patterns from [Jest](./devdocs/jest.md) + [SQLite](./devdocs/sqlite-better-sqlite3.md) documentation:**

#### Database Tests (backend/tests/models.test.ts)
**Copy repository testing patterns from SQLite documentation:**
```typescript
describe('Database Models', () => {
  describe('ServiceLog Model', () => {
    test('should create service log with required fields')
    test('should enforce foreign key constraints')
    test('should cascade delete patient entries')
    test('should save draft status')
  })
  
  describe('Client Model', () => {
    test('should create/update/delete clients')
    test('should prevent deletion with existing logs')
  })
  
  describe('Activity Model', () => {
    test('should manage activity types')
    test('should track usage in service logs')
  })
  
  describe('CustomField Model', () => {
    test('should create dynamic fields with choices')
    test('should maintain field ordering')
    test('should handle field type changes')
  })
})
```

### Database Schema
**📖 Copy schema patterns from [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)**
**🚨 Use documented healthcare table structures, indexes, and constraints**
```sql
-- Users table (follow documented User interface patterns)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'candidate')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Clients/Sites
CREATE TABLE clients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1
);

-- Activities/Specialties
CREATE TABLE activities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1
);

-- Outcomes
CREATE TABLE outcomes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1
);

-- Service Logs
CREATE TABLE service_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id),
  activity_id INTEGER REFERENCES activities(id),
  patient_count INTEGER NOT NULL,
  is_draft BOOLEAN DEFAULT 0,
  submitted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Patient Entries
CREATE TABLE patient_entries (
  id INTEGER PRIMARY KEY,
  service_log_id INTEGER REFERENCES service_logs(id) ON DELETE CASCADE,
  new_patients INTEGER DEFAULT 0,
  followup_patients INTEGER DEFAULT 0,
  dna_count INTEGER DEFAULT 0,
  outcome_id INTEGER REFERENCES outcomes(id)
);

-- Custom Fields
CREATE TABLE custom_fields (
  id INTEGER PRIMARY KEY,
  field_label TEXT NOT NULL,
  field_type TEXT DEFAULT 'dropdown',
  field_order INTEGER,
  is_active BOOLEAN DEFAULT 1
);

-- Custom Field Choices
CREATE TABLE field_choices (
  id INTEGER PRIMARY KEY,
  field_id INTEGER REFERENCES custom_fields(id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  choice_order INTEGER
);

-- Custom Field Values
CREATE TABLE custom_field_values (
  id INTEGER PRIMARY KEY,
  patient_entry_id INTEGER REFERENCES patient_entries(id) ON DELETE CASCADE,
  field_id INTEGER REFERENCES custom_fields(id),
  choice_id INTEGER REFERENCES field_choices(id)
);
```

### Deliverables
**🚨 Each deliverable MUST follow documented patterns:**
1. **Database schema** → Copy healthcare table designs from [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)
2. **Migration system** → Use documented migration patterns with audit logging
3. **Model classes** → Follow TypeScript interface patterns from [TypeScript Documentation](./devdocs/typescript.md)
4. **Repository pattern** → Copy BaseRepository and domain-specific repositories from SQLite documentation
5. **Seed data** → Use documented healthcare test data patterns

**📖 Pattern Rule**: Every database operation must follow the documented repository pattern with proper error handling and audit logging.

### Success Criteria
- All model tests pass
- Database migrations run successfully
- Foreign key constraints enforced
- Data integrity maintained

---

## Phase 3: Candidate Portal - Basic Form (Week 3)
**📚 PRIMARY DOCUMENTATION**: [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md) + [shadcn/ui](./devdocs/shadcn-ui.md) + [Tailwind CSS](./devdocs/tailwind.md)

### Objectives
Implement core service log form using documented medical form patterns, validation schemas, and healthcare UI components.

### 🚨 MANDATORY Pre-Phase Steps
1. **Read [React Hook Form Documentation](./devdocs/react-hook-form.md)** - Medical form structures and validation patterns
2. **Study [Zod Documentation](./devdocs/zod.md)** - Healthcare data validation and custom validators
3. **Review [shadcn/ui Documentation](./devdocs/shadcn-ui.md)** - Medical form components and accessibility
4. **Check [Tailwind CSS Documentation](./devdocs/tailwind.md)** - Healthcare responsive design patterns
5. **Copy documented form examples** rather than creating custom implementations

### Pre-Phase Test Specifications
**📖 Follow component testing patterns from [React Testing Library Documentation](./devdocs/react-testing-library.md)**

#### E2E Tests (e2e-tests/candidate-form.spec.ts)
**Copy form testing patterns from React Testing Library documentation:**
```typescript
describe('Service Log Form', () => {
  test('candidate can select client from dropdown')
  test('candidate can select activity from dropdown')
  test('patient count generates correct number of rows')
  test('form validates required fields')
  test('save draft preserves partial data')
  test('clear form resets all fields')
  test('successful submission shows confirmation')
  test('form handles API errors gracefully')
})
```

#### Component Tests (frontend/tests/ServiceLogForm.test.tsx)
```typescript
describe('ServiceLogForm Component', () => {
  test('renders all required form fields')
  test('dynamically adds patient rows based on count')
  test('calculates totals correctly')
  test('validates patient number logic')
  test('handles dropdown population from API')
})
```

### UI Components
**🚨 COPY COMPONENT PATTERNS FROM DOCUMENTATION - DO NOT CREATE CUSTOM IMPLEMENTATIONS**

1. **Service Log Form Page** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented medical form layouts with accessibility
   - Use documented floating label patterns
   - Implement documented real-time validation from React Hook Form + Zod
   - Follow documented animation patterns for dynamic elements

2. **Patient Entry Rows** → [Tailwind CSS Documentation](./devdocs/tailwind.md)
   - Use documented table row styling with healthcare color palette
   - Copy documented number input components with accessibility
   - Implement documented dropdown patterns from shadcn/ui
   - Use documented calculation and totaling patterns

3. **Action Buttons** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented button variants and loading states
   - Use documented auto-save patterns from React Hook Form
   - Implement documented confirmation dialog patterns

**📖 Implementation Rule**: Find the component in the documentation first, copy the healthcare-specific example, then adapt for your specific use case.

### Deliverables
**🚨 Each deliverable MUST follow documented patterns:**
1. **Service log form** → Copy form structure from [React Hook Form Documentation](./devdocs/react-hook-form.md) with Zod validation
2. **Dynamic patient rows** → Use documented array field patterns from React Hook Form
3. **API endpoints** → Follow RESTful patterns from [Express.js Documentation](./devdocs/express.md) with validation middleware
4. **Draft saving** → Copy auto-save patterns from React Hook Form documentation
5. **Form state management** → Use documented React Hook Form patterns with TypeScript
6. **Notifications** → Implement documented toast patterns from shadcn/ui

**📖 Validation Rule**: All form validation must use documented Zod schemas for healthcare data with proper error handling patterns.

### Success Criteria
- All form tests pass
- Form submissions save to database
- Draft functionality works
- Validation provides clear feedback
- Mobile-responsive layout

---

## Phase 3.5: Service Form Enhancements - Appointment Structure & Date Field
**📚 PRIMARY DOCUMENTATION**: [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md) + [TypeScript](./devdocs/typescript.md)

### Objectives
Transform patient entry structure from count-based to appointment-based model and add service date tracking following documented form enhancement patterns.

### 🚨 MANDATORY Pre-Phase Steps
1. **Review [React Hook Form Documentation](./devdocs/react-hook-form.md)** - Array field patterns and dynamic form structures
2. **Study [Zod Documentation](./devdocs/zod.md)** - Enum validation and schema transformation patterns
3. **Check [TypeScript Documentation](./devdocs/typescript.md)** - Union types and enum patterns for appointment types
4. **Follow documented component enhancement patterns** rather than creating new implementations

### Key Changes Made

#### 1. Patient Entry Structure Transformation
**FROM**: Count-based model (New Patients: 3, Follow-up: 2, DNA: 1)  
**TO**: Appointment-based model (Each entry = 1 appointment with type selection)

- **New AppointmentType enum**:
  ```typescript
  export type AppointmentType = 'new' | 'followup' | 'dna';
  ```

- **Updated PatientEntry interface**:
  ```typescript
  export interface PatientEntry {
    appointmentType: AppointmentType;
    outcomeId: OutcomeId;
  }
  ```

- **Enhanced form validation** with Zod enum schema:
  ```typescript
  const appointmentTypeSchema = z.enum(['new', 'followup', 'dna']);
  const patientEntrySchema = z.object({
    appointmentType: appointmentTypeSchema,
    outcomeId: requiredStringSchema.uuid('Please select an outcome'),
  });
  ```

#### 2. Service Date Field Addition
- **Created DatePicker component** following documented Input component patterns
- **Added serviceDate to form schema** with required validation
- **Positioned between Activity/Specialty and Patient Count** as requested
- **Integrated with React Hook Form** using register pattern

#### 3. Form Logic Updates
- **Dynamic row generation** based on patient count with appointment type dropdowns
- **Updated calculation logic** to aggregate appointment types:
  ```typescript
  const calculateTotals = () => {
    return watchPatientEntries.reduce((totals, entry) => ({
      total: totals.total + 1,
      new: totals.new + (entry.appointmentType === 'new' ? 1 : 0),
      followup: totals.followup + (entry.appointmentType === 'followup' ? 1 : 0),
      dna: totals.dna + (entry.appointmentType === 'dna' ? 1 : 0),
    }), { total: 0, new: 0, followup: 0, dna: 0 });
  };
  ```

### Critical Bug Fixes Implemented

#### 1. Giant Exclamation Mark in Dropdowns
- **Issue**: SVG icons scaling to massive proportions in Select components
- **Root Cause**: Flexible SVG sizing without constraints
- **Fix**: Added explicit sizing constraints with flex-shrink-0
  ```typescript
  <svg className="w-4 h-4 mr-1 flex-shrink-0" 
       style={{ 
         width: '16px', height: '16px', 
         minWidth: '16px', minHeight: '16px', 
         maxWidth: '16px', maxHeight: '16px' 
       }}>
  ```

#### 2. Form Submission Failure
- **Issue**: Save button not triggering any action
- **Root Cause**: Toast API function name mismatches (`toast()` vs `showToast()`)
- **Fix**: Updated all toast calls to use correct useToast hook API
- **Updated calculation logic** for new appointment type structure

#### 3. Infinite Toast Notification Loop
- **Issue**: Screen flooded with continuous toast notifications preventing form visibility
- **Root Cause**: useEffect dependency arrays including functions that changed on every render
- **Fix**: Removed problematic dependencies and added state guards:
  ```typescript
  useEffect(() => {
    localStorage.removeItem('serviceLogDraft');
    loadFormOptions();
  }, []); // No dependencies to prevent infinite loop
  ```
- **Added draft clearing mechanism** to prevent stuck localStorage data
- **Reduced toast duration** from 5000ms to 3000ms for better UX

### Files Modified
- `frontend/src/components/DatePicker.tsx` (Created)
- `frontend/src/types/index.ts` (Enhanced with AppointmentType enum)
- `frontend/src/utils/validation.ts` (Updated Zod schemas)
- `frontend/src/components/ServiceLogForm.tsx` (Major restructuring)
- `frontend/src/pages/ServiceLogPage.tsx` (Toast fixes and calculation updates)
- `frontend/src/components/Select.tsx` (SVG sizing fix)
- `frontend/src/hooks/useToast.tsx` (Duration adjustment)

### Technical Patterns Applied
- **Documented enum patterns** from TypeScript documentation
- **Array field management** from React Hook Form documentation
- **Conditional validation** using Zod enum schemas
- **Component enhancement** following shadcn/ui patterns
- **useEffect optimization** to prevent infinite loops
- **localStorage management** for draft persistence

### Success Criteria
- [x] Patient entries use appointment type selections instead of counts
- [x] Service date field added in correct position
- [x] Form calculations updated for new structure
- [x] All dropdowns display correctly without visual artifacts
- [x] Form submission works without errors
- [x] Toast notifications function properly without infinite loops
- [x] Auto-save functionality preserved
- [x] Form validation maintains healthcare data integrity
- [x] Summary section reflects appointment-based counting
- [x] Mobile-responsive layout maintained

---

## Phase 4: Admin Portal - User Management (Week 4)
**📚 PRIMARY DOCUMENTATION**: [shadcn/ui](./devdocs/shadcn-ui.md) + [Express.js](./devdocs/express.md) + [React 18](./devdocs/react-18.md)

### Objectives
Build comprehensive user management using documented admin interface patterns, data table components, and admin API patterns.

### 🚨 MANDATORY Pre-Phase Steps
1. **Read [shadcn/ui Documentation](./devdocs/shadcn-ui.md)** - Admin dashboard and data table patterns
2. **Study [Express.js Documentation](./devdocs/express.md)** - Admin API endpoints with proper authorization
3. **Review [React 18 Documentation](./devdocs/react-18.md)** - Performance patterns for large datasets
4. **Check [TypeScript Documentation](./devdocs/typescript.md)** - Admin interface definitions
5. **Copy documented admin examples** rather than creating custom implementations

### Pre-Phase Test Specifications
**📖 Follow admin testing patterns from documentation:**

#### E2E Tests (e2e-tests/admin-users.spec.ts)
**Copy admin interface testing patterns from React Testing Library documentation:**
```typescript
describe('User Management', () => {
  test('admin can view all users in table')
  test('admin can create new candidate account')
  test('admin can edit user details')
  test('admin can activate/deactivate accounts')
  test('admin can search/filter users')
  test('admin can reset user passwords')
})
```

#### API Tests (backend/tests/user-management.test.ts)
```typescript
describe('User Management API', () => {
  test('GET /api/admin/users - returns paginated users')
  test('POST /api/admin/users - creates new user')
  test('PUT /api/admin/users/:id - updates user')
  test('DELETE /api/admin/users/:id - soft deletes user')
  test('POST /api/admin/users/:id/reset-password')
})
```

### UI Components
**🚨 COPY ADMIN PATTERNS FROM DOCUMENTATION - DO NOT CREATE CUSTOM IMPLEMENTATIONS**

1. **Users Table** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented data table component with sorting and filtering
   - Use documented inline editing patterns with validation
   - Implement documented badge and status components
   - Follow documented pagination patterns with performance optimization
   - Copy documented bulk action patterns with accessibility

2. **Create User Modal** → [shadcn/ui](./devdocs/shadcn-ui.md) + [React Hook Form](./devdocs/react-hook-form.md)
   - Use documented dialog and form wizard patterns
   - Copy documented password strength validation from Zod
   - Implement documented role selection components
   - Use documented real-time validation patterns

3. **User Actions Menu** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented dropdown menu patterns with accessibility
   - Use documented confirmation dialog patterns
   - Implement documented action button patterns with loading states

**📖 Performance Rule**: All admin interfaces must use documented performance optimization patterns for large datasets from React 18 documentation.

### Deliverables
**🚨 Each deliverable MUST follow documented patterns:**
1. **User management dashboard** → Copy admin layout patterns from [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
2. **CRUD operations** → Use documented API patterns from [Express.js Documentation](./devdocs/express.md) with proper validation
3. **Password reset** → Copy security patterns from Express.js documentation with audit logging
4. **Search and filtering** → Use documented search patterns with performance optimization
5. **Bulk operations** → Implement documented bulk action patterns with confirmation dialogs
6. **Activity logging** → Follow audit logging patterns from [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)

**📖 Security Rule**: All admin operations must include documented audit logging patterns and proper authorization checks.

### Success Criteria
- All user management tests pass
- Admin can perform all CRUD operations
- Search and filters work correctly
- UI provides clear feedback

---

## Phase 5: Admin Portal - Template Management (Week 5)
**📚 PRIMARY DOCUMENTATION**: [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md) + [shadcn/ui](./devdocs/shadcn-ui.md)

### Objectives
Implement configuration system using documented template management patterns, dynamic form builders, and admin configuration interfaces.

### 🚨 MANDATORY Pre-Phase Steps
1. **Read [React Hook Form Documentation](./devdocs/react-hook-form.md)** - Dynamic field management and template patterns
2. **Study [Zod Documentation](./devdocs/zod.md)** - Dynamic schema validation and field dependencies
3. **Review [shadcn/ui Documentation](./devdocs/shadcn-ui.md)** - Admin configuration components and drag-drop patterns
4. **Check [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)** - Template storage and versioning patterns
5. **Copy documented template examples** rather than creating custom implementations

### Pre-Phase Test Specifications
**📖 Follow template testing patterns from documentation:**

#### E2E Tests (e2e-tests/admin-templates.spec.ts)
**Copy template management testing patterns from React Testing Library documentation:**
```typescript
describe('Template Management', () => {
  test('admin can add/edit/remove clients')
  test('admin can add/edit/remove activities')
  test('admin can add/edit/remove outcomes')
  test('admin can create custom dropdown fields')
  test('admin can manage dropdown choices')
  test('changes reflect in candidate form immediately')
})
```

#### Integration Tests (backend/tests/template.integration.test.ts)
```typescript
describe('Template Configuration API', () => {
  test('manages clients with validation')
  test('manages activities with validation')
  test('manages outcomes with validation')
  test('creates custom fields with choices')
  test('reorders custom fields')
  test('validates unique field names')
})
```

### UI Components
**🚨 COPY TEMPLATE MANAGEMENT PATTERNS FROM DOCUMENTATION - DO NOT CREATE CUSTOM IMPLEMENTATIONS**

1. **Template Dashboard** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented tab navigation patterns with accessibility
   - Use documented drag-and-drop patterns with react-beautiful-dnd
   - Implement documented live preview patterns with real-time updates
   - Follow documented import/export patterns with file handling

2. **Entity Management Cards** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented card component patterns with inline editing
   - Use documented toggle switch components with accessibility
   - Implement documented statistics display patterns
   - Follow documented duplication patterns with validation

3. **Custom Field Builder** → [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md)
   - Copy documented dynamic field type patterns
   - Use documented choice management patterns from React Hook Form
   - Implement documented field preview patterns
   - Follow documented validation rule builder patterns from Zod

**📖 Dynamic Pattern Rule**: All template functionality must use documented dynamic field patterns with proper TypeScript typing and validation.

### Deliverables
**🚨 Each deliverable MUST follow documented patterns:**
1. **Template dashboard** → Copy admin layout patterns from [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
2. **CRUD operations** → Use documented API patterns from [Express.js Documentation](./devdocs/express.md) with template validation
3. **Custom field system** → Copy dynamic field patterns from [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md)
4. **Drag-and-drop** → Use documented ordering patterns from shadcn/ui with persistence
5. **Template preview** → Implement documented live preview patterns with real-time validation
6. **Import/export** → Follow documented file handling patterns with validation and error handling

**📖 Validation Rule**: All template operations must use documented Zod schema patterns for dynamic validation with proper TypeScript inference.

### Success Criteria
- All template tests pass
- Changes reflect immediately in forms
- Custom fields work as expected
- Ordering persists correctly

---

## Phase 6: Dynamic Fields & Advanced Forms (Week 6)
**📚 PRIMARY DOCUMENTATION**: [Zod](./devdocs/zod.md) + [React Hook Form](./devdocs/react-hook-form.md) + [TypeScript](./devdocs/typescript.md)

### Objectives
Integrate custom fields using documented dynamic validation patterns, conditional field logic, and advanced form state management patterns.

### 🚨 MANDATORY Pre-Phase Steps
1. **Read [Zod Documentation](./devdocs/zod.md)** - Dynamic schema creation and conditional validation patterns
2. **Study [React Hook Form Documentation](./devdocs/react-hook-form.md)** - Array fields, field dependencies, and conditional logic
3. **Review [TypeScript Documentation](./devdocs/typescript.md)** - Dynamic type inference and conditional types
4. **Check [React 18 Documentation](./devdocs/react-18.md)** - Performance patterns for dynamic components
5. **Copy documented dynamic field examples** rather than creating custom implementations

### Pre-Phase Test Specifications
**📖 Follow dynamic field testing patterns from documentation:**

#### E2E Tests (e2e-tests/dynamic-fields.spec.ts)
**Copy dynamic field testing patterns from React Testing Library documentation:**
```typescript
describe('Dynamic Fields', () => {
  test('custom fields appear in service log form')
  test('custom field validation works')
  test('custom field values save correctly')
  test('conditional field logic works')
  test('field dependencies handled properly')
})
```

#### Component Tests (frontend/tests/DynamicField.test.tsx)
```typescript
describe('DynamicField Component', () => {
  test('renders correct field type')
  test('loads choices from configuration')
  test('handles required field validation')
  test('integrates with form state')
  test('shows/hides based on conditions')
})
```

### Advanced Features
**🚨 COPY ADVANCED PATTERNS FROM DOCUMENTATION - DO NOT CREATE CUSTOM IMPLEMENTATIONS**

1. **Conditional Logic** → [Zod](./devdocs/zod.md) + [React Hook Form](./devdocs/react-hook-form.md)
   - Copy documented conditional validation patterns from Zod
   - Use documented field dependency patterns from React Hook Form
   - Implement documented calculated field patterns with proper TypeScript typing

2. **Field Types Support** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented select component patterns (single and multi)
   - Use documented input component variants (text, number, date)
   - Implement documented radio button and checkbox patterns
   - Follow documented accessibility patterns for all field types

3. **Smart Defaults** → [React 18 Documentation](./devdocs/react-18.md)
   - Use documented localStorage patterns for value persistence
   - Copy documented auto-fill patterns with performance optimization
   - Implement documented template default patterns with type safety

**📖 Performance Rule**: All dynamic fields must use documented React 18 performance patterns (memoization, lazy loading) to handle complex forms efficiently.

### Deliverables
**🚨 Each deliverable MUST follow documented patterns:**
1. **Dynamic field system** → Copy rendering patterns from [React Hook Form Documentation](./devdocs/react-hook-form.md) with TypeScript
2. **Conditional logic** → Use documented conditional patterns from [Zod Documentation](./devdocs/zod.md)
3. **Field type components** → Copy component patterns from [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
4. **Validation integration** → Follow documented Zod + React Hook Form integration patterns
5. **Value persistence** → Use documented localStorage patterns from [React 18 Documentation](./devdocs/react-18.md)
6. **Dependency management** → Implement documented field dependency patterns with proper TypeScript typing

**📖 Type Safety Rule**: All dynamic field operations must use documented TypeScript conditional types and Zod inference patterns for full type safety.

### Success Criteria
- All dynamic field tests pass
- Custom fields integrate seamlessly
- Conditional logic works reliably
- Performance remains smooth

---

## Phase 7: Data Management & Reporting (Week 7)
**📚 PRIMARY DOCUMENTATION**: [SQLite](./devdocs/sqlite-better-sqlite3.md) + [Express.js](./devdocs/express.md) + [React 18](./devdocs/react-18.md)

### Objectives
Build comprehensive data viewing using documented query optimization patterns, export functionality, and performance patterns for large datasets.

### 🚨 MANDATORY Pre-Phase Steps
1. **Read [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)** - Query optimization, indexing, and reporting patterns
2. **Study [Express.js Documentation](./devdocs/express.md)** - API endpoint patterns for data export and streaming
3. **Review [React 18 Documentation](./devdocs/react-18.md)** - Performance patterns for large dataset rendering
4. **Check [shadcn/ui Documentation](./devdocs/shadcn-ui.md)** - Data table and filtering component patterns
5. **Copy documented reporting examples** rather than creating custom implementations

### Pre-Phase Test Specifications
**📖 Follow reporting testing patterns from documentation:**

#### E2E Tests (e2e-tests/reporting.spec.ts)
**Copy reporting interface testing patterns from React Testing Library documentation:**
```typescript
describe('Data Management', () => {
  test('view all submissions in table')
  test('filter by date range')
  test('filter by client/activity/user')
  test('export to CSV format')
  test('export to Excel format')
  test('view detailed submission')
  test('generate summary reports')
})
```

#### API Tests (backend/tests/reporting.test.ts)
```typescript
describe('Reporting API', () => {
  test('GET /api/submissions - returns filtered data')
  test('GET /api/submissions/:id - returns details')
  test('GET /api/reports/export - generates CSV')
  test('GET /api/reports/summary - aggregates data')
  test('applies date range filters correctly')
})
```

### UI Components
**🚨 COPY REPORTING PATTERNS FROM DOCUMENTATION - DO NOT CREATE CUSTOM IMPLEMENTATIONS**

1. **Submissions Table** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented data table component with advanced filtering
   - Use documented column customization patterns with persistence
   - Implement documented saved filter patterns with localStorage
   - Follow documented inline viewing patterns with performance optimization
   - Copy documented export dropdown patterns with accessibility

2. **Filter Builder** → [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md)
   - Use documented date range picker patterns from shadcn/ui
   - Copy documented multi-select patterns with search
   - Implement documented filter persistence patterns
   - Follow documented clear/reset patterns with proper state management

3. **Export Modal** → [shadcn/ui](./devdocs/shadcn-ui.md) + [Express.js](./devdocs/express.md)
   - Copy documented dialog patterns with form validation
   - Use documented checkbox selection patterns
   - Implement documented file export patterns from Express.js
   - Follow documented email delivery patterns with proper security

4. **Analytics Dashboard** → [React 18](./devdocs/react-18.md) + [shadcn/ui](./devdocs/shadcn-ui.md)
   - Copy documented card component patterns with statistics
   - Use documented chart integration patterns (if available) or simple implementations
   - Implement documented data visualization patterns with accessibility
   - Follow documented download patterns with proper file handling

**📖 Performance Rule**: All reporting interfaces must use documented React 18 performance patterns (virtualization, pagination) for handling large datasets efficiently.

### Deliverables
**🚨 Each deliverable MUST follow documented patterns:**
1. **Submissions interface** → Copy data table patterns from [shadcn/ui Documentation](./devdocs/shadcn-ui.md) with performance optimization
2. **Advanced filtering** → Use documented filter patterns from React Hook Form with Zod validation
3. **Export functionality** → Follow documented export patterns from [Express.js Documentation](./devdocs/express.md) with streaming
4. **Summary reports** → Copy documented query optimization patterns from [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)
5. **Analytics dashboard** → Use documented dashboard layout patterns from shadcn/ui
6. **Saved searches** → Implement documented persistence patterns from React 18 with proper TypeScript typing

**📖 Query Optimization Rule**: All reporting queries must use documented SQLite optimization patterns (indexes, prepared statements, pagination) from the database documentation.

### Success Criteria
- All reporting tests pass
- Exports contain correct data
- Filters work in combination
- Performance with large datasets

---

## Phase 8: Polish, Optimization & Deployment (Week 8)
**📚 PRIMARY DOCUMENTATION**: [ALL DOCUMENTATION](./devdocs/index.md) - Comprehensive review and optimization

### Objectives
Finalize application using documented production patterns, performance optimization strategies, and security hardening from all documentation sources.

### 🚨 MANDATORY Pre-Phase Steps
1. **Review [Documentation Index](./devdocs/index.md)** - Complete checklist of all documented patterns
2. **Audit against all documentation** - Ensure every implemented pattern follows documented examples
3. **Security audit** - Review all security patterns from Express.js and other documentation
4. **Performance audit** - Apply all performance patterns from React 18, SQLite, and other documentation
5. **Accessibility audit** - Verify all accessibility patterns from shadcn/ui documentation are implemented

### Pre-Phase Test Specifications
**📖 Follow production testing patterns from all documentation:**

#### Performance Tests
**Copy performance testing patterns from all relevant documentation:**
```typescript
describe('Performance', () => {
  test('page load time < 2 seconds')
  test('form submission < 1 second')
  test('handles 1000+ rows efficiently')
  test('search returns results < 500ms')
  test('no memory leaks in long sessions')
})
```

#### Accessibility Tests
```typescript
describe('Accessibility', () => {
  test('meets WCAG 2.1 AA standards')
  test('keyboard navigation complete')
  test('screen reader compatible')
  test('color contrast sufficient')
  test('focus indicators visible')
})
```

#### Security Tests
```typescript
describe('Security', () => {
  test('SQL injection prevention')
  test('XSS protection')
  test('CSRF protection')
  test('rate limiting works')
  test('secure headers present')
})
```

### UI/UX Enhancements
**🚨 APPLY ALL DOCUMENTED OPTIMIZATION PATTERNS - NO CUSTOM IMPLEMENTATIONS**

1. **Micro-interactions** → [shadcn/ui Documentation](./devdocs/shadcn-ui.md)
   - Copy documented button interaction patterns with accessibility
   - Use documented transition patterns from Tailwind CSS
   - Implement documented loading skeleton patterns from shadcn/ui
   - Follow documented animation patterns with proper performance

2. **Error Handling** → [React 18](./devdocs/react-18.md) + [Express.js](./devdocs/express.md)
   - Copy documented error boundary patterns from React 18
   - Use documented error page patterns from Express.js
   - Implement documented retry mechanism patterns
   - Follow documented offline support patterns (if available)

3. **Performance Optimizations** → [ALL DOCUMENTATION](./devdocs/index.md)
   - Apply documented code splitting patterns from React 18
   - Use documented lazy loading patterns from React 18
   - Implement documented image optimization patterns
   - Apply documented database indexing from SQLite documentation
   - Use documented query optimization patterns from SQLite
   - Follow documented caching patterns from Express.js

4. **Production Readiness** → [Express.js Documentation](./devdocs/express.md)
   - Copy documented environment configuration patterns
   - Use documented logging patterns with healthcare compliance
   - Implement documented monitoring patterns
   - Follow documented backup procedures for healthcare data
   - Apply documented security hardening patterns

**📖 Optimization Rule**: Every optimization must follow a documented pattern - no custom performance solutions without documentation precedent.

### Deliverables
**🚨 Each deliverable MUST validate against documented patterns:**
1. **Performance optimizations** → Verify all React 18, SQLite, and Express.js performance patterns are implemented
2. **Accessibility audit** → Validate against all shadcn/ui and Tailwind CSS accessibility patterns
3. **Security hardening** → Apply all security patterns from Express.js and TypeScript documentation
4. **Production deployment** → Follow documented deployment patterns (if available) or industry standards
5. **User documentation** → Document using patterns established in devdocs structure
6. **Admin documentation** → Create documentation following devdocs formatting and structure
7. **API documentation** → Document using Express.js API documentation patterns
8. **Monitoring dashboard** → Implement using documented monitoring patterns

**📖 Documentation Rule**: All final documentation must follow the same structure and quality standards as the devdocs directory.

### Success Criteria
- All performance benchmarks met
- Accessibility standards achieved
- Security scan passes
- Zero critical bugs
- Documentation complete

---

## Testing Strategy
**📚 Follow testing patterns from [Jest](./devdocs/jest.md) + [React Testing Library](./devdocs/react-testing-library.md) documentation**

### Test Pyramid
**🚨 All testing must use documented healthcare-specific patterns:**

1. **Unit Tests (60%)** → [Jest Documentation](./devdocs/jest.md)
   - Copy documented unit testing patterns for healthcare business logic
   - Use documented mocking patterns for external services
   - Follow documented utility function testing patterns
   - Apply documented coverage thresholds (80% minimum, 90% for critical modules)

2. **Integration Tests (30%)** → [Jest](./devdocs/jest.md) + [Express.js](./devdocs/express.md)
   - Copy documented API endpoint testing patterns
   - Use documented database operation testing patterns from SQLite documentation
   - Follow documented service interaction testing patterns
   - Apply documented authentication and authorization testing patterns

3. **E2E Tests (10%)** → React Testing Library + Playwright patterns
   - Copy documented critical user journey testing patterns
   - Use documented cross-browser testing approaches
   - Follow documented mobile responsiveness testing patterns
   - Apply documented accessibility testing patterns

**📖 TDD Rule**: All testing must follow the documented Test-Driven Development approach - write documented test patterns first, then implement to pass those tests.

### Continuous Integration
**📖 Follow documented CI patterns and quality gates:**
- **Run tests** using documented Jest patterns with proper healthcare coverage thresholds
- **Code quality checks** following documented TypeScript, ESLint, and Prettier patterns
- **Performance regression** using documented performance testing patterns
- **Security scanning** following documented Express.js security patterns
- **Documentation validation** ensuring all code follows documented patterns

**🚨 Quality Gate**: No code deployment without validation against documented patterns and minimum 80% test coverage following Jest documentation standards.

### Test Documentation
Each phase includes:
- Test plan document
- Test cases specification
- Test execution reports
- Bug tracking and resolution

---

## Risk Mitigation
**📖 All risk mitigation must use documented patterns**

### Technical Risks
1. **SQLite Scalability** → [SQLite Documentation](./devdocs/sqlite-better-sqlite3.md)
   - **Mitigation**: Use documented migration patterns for PostgreSQL compatibility
   - Apply documented connection pooling and performance optimization patterns
   - Implement documented monitoring patterns for healthcare data

2. **Complex Form State** → [React Hook Form Documentation](./devdocs/react-hook-form.md)
   - **Mitigation**: Use documented React Hook Form patterns for complex medical forms
   - Apply documented auto-save patterns with error recovery
   - Follow documented error handling patterns from React 18

3. **Dynamic Fields Complexity** → [Zod](./devdocs/zod.md) + [TypeScript](./devdocs/typescript.md)
   - **Mitigation**: Use documented dynamic field patterns from React Hook Form + Zod
   - Apply documented TypeScript conditional type patterns for type safety
   - Follow documented testing patterns for dynamic functionality edge cases

**🚨 Documentation Risk**: The highest risk is not following documented patterns - always reference documentation before implementing any solution.

### Process Risks
1. **Scope Creep**
   - **Mitigation**: Strict adherence to documented patterns only
   - Document any new patterns in devdocs before implementation
   - Regular validation against documented phase requirements

2. **Testing Overhead** → [Jest Documentation](./devdocs/jest.md)
   - **Mitigation**: Use documented test automation patterns from project start
   - Apply documented parallel test execution patterns
   - Follow documented selective test running patterns for efficient development

3. **Pattern Deviation Risk** → **NEW CRITICAL RISK**
   - **Mitigation**: Mandatory documentation review before any code implementation
   - Code review process validates against documented patterns
   - Regular audits to ensure all code follows documented healthcare-specific patterns

**📖 Process Rule**: Any deviation from documented patterns must be approved and documented in devdocs before implementation.

---

## Success Metrics
**📖 All metrics must align with documented performance targets**

### Technical Metrics
**🚨 Validate against documented standards:**
- **Test coverage > 80%** following [Jest Documentation](./devdocs/jest.md) coverage thresholds
- **Page load time < 2 seconds** using documented [React 18](./devdocs/react-18.md) performance patterns
- **API response time < 200ms** following documented [Express.js](./devdocs/express.md) optimization patterns
- **Zero critical vulnerabilities** using documented [Express.js](./devdocs/express.md) security patterns
- **99.9% uptime** with documented monitoring and error handling patterns
- **100% pattern compliance** - all code follows documented healthcare-specific patterns

### User Experience Metrics
**📖 Measured against documented accessibility and usability patterns:**
- **Task completion rate > 95%** using documented [shadcn/ui](./devdocs/shadcn-ui.md) accessibility patterns
- **Error rate < 2%** with documented [React Hook Form](./devdocs/react-hook-form.md) + [Zod](./devdocs/zod.md) validation patterns
- **User satisfaction > 4.5/5** through documented healthcare-specific UX patterns
- **Support ticket rate < 5%** with documented error handling and user guidance patterns
- **Mobile usage > 40%** using documented [Tailwind CSS](./devdocs/tailwind.md) responsive patterns
- **WCAG 2.1 AA compliance** following documented accessibility patterns

### Business Metrics
**📖 Achieved through documented efficiency and performance patterns:**
- **User adoption rate > 80%** with documented healthcare-specific UX patterns
- **Data entry time reduction > 50%** using documented [React Hook Form](./devdocs/react-hook-form.md) auto-save and smart defaults
- **Report generation < 1 minute** with documented [SQLite](./devdocs/sqlite-better-sqlite3.md) query optimization
- **System reliability > 99.9%** using documented error handling and monitoring patterns
- **HIPAA compliance 100%** following documented healthcare security and audit patterns

---

## Maintenance & Future Enhancements
**📖 All future development must extend documented patterns**

### Phase 9+ Considerations
**🚨 Each enhancement must first establish documentation patterns:**
1. **Advanced analytics** - Extend documented [SQLite](./devdocs/sqlite-better-sqlite3.md) query patterns
2. **Multi-tenancy** - Extend documented [Express.js](./devdocs/express.md) security and data isolation patterns
3. **Third-party APIs** - Extend documented API patterns with proper validation
4. **Mobile native apps** - Create new documentation following existing pattern structure
5. **Real-time features** - Extend documented [React 18](./devdocs/react-18.md) state management patterns
6. **Workflow automation** - Extend documented business logic patterns
7. **Compliance reporting** - Extend documented healthcare audit and logging patterns
8. **Internationalization** - Create new documentation for i18n patterns

**📚 Documentation-First Rule**: No new feature development without first creating comprehensive documentation following existing devdocs patterns.

### Maintenance Plan
**📖 All maintenance must validate against documented patterns:**
- **Weekly security updates** - Validate against documented [Express.js](./devdocs/express.md) security patterns
- **Monthly feature updates** - Ensure all new features follow documented patterns in devdocs
- **Quarterly performance reviews** - Audit against documented performance patterns from all technologies
- **Annual architecture reviews** - Validate entire codebase follows documented patterns
- **Quarterly documentation updates** - Update devdocs with new patterns and lessons learned
- **Continuous pattern compliance** - Regular code audits to ensure documented pattern adherence

**🚨 Maintenance Rule**: Any code that doesn't follow documented patterns must be refactored to match established healthcare-specific implementations.

---

## Conclusion

**This plan provides a documentation-driven, test-first approach to building a robust healthcare service log portal following established patterns.** Each phase builds upon documented implementations with healthcare-specific considerations, security measures, and accessibility compliance.

### 🚨 CRITICAL SUCCESS FACTORS:
1. **Documentation-First Development** - Every implementation must reference and follow patterns from `/devdocs/`
2. **Healthcare-Specific Patterns** - Use documented medical data validation, HIPAA compliance, and healthcare UX patterns
3. **Test-Driven Development** - Follow documented testing patterns with healthcare-appropriate coverage thresholds
4. **Pattern Compliance** - All code must follow documented examples rather than custom implementations
5. **Security & Accessibility** - Apply documented patterns for healthcare data protection and medical device compatibility

### The Documentation-Driven Approach Ensures:
- **Consistent Implementation** - All code follows proven healthcare-specific patterns
- **Reduced Risk** - Tested patterns minimize implementation errors
- **HIPAA Compliance** - Built-in security and audit patterns for healthcare data
- **Maintainability** - Documented patterns enable easier maintenance and updates
- **Scalability** - Proven performance patterns handle growth requirements
- **Accessibility** - Documented WCAG 2.1 AA compliance patterns for medical environments

### 📚 DEVELOPMENT COMMANDMENTS:
1. **Thou shalt always check documentation first** - Never implement without consulting `/devdocs/`
2. **Thou shalt copy documented examples** - Adapt proven patterns, don't invent new ones
3. **Thou shalt write tests first** - Follow documented TDD patterns for all features
4. **Thou shalt validate against patterns** - Ensure every implementation matches documented examples
5. **Thou shalt update documentation** - Add new patterns to devdocs as the project evolves

**By following documented patterns and maintaining healthcare-specific compliance, we ensure the application is reliable, secure, maintainable, and scalable for future growth while meeting strict healthcare industry requirements.**