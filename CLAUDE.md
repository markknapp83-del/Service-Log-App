# Healthcare Service Log Portal - Development Guidelines

## Project Overview
Building a healthcare service log portal for tracking patient services with dynamic forms and comprehensive admin management. This project follows strict Test-Driven Development (TDD) principles with a focus on simplicity and iterative optimization.

## 📚 MANDATORY: Use Project Documentation
**ALL development must reference the comprehensive documentation in `/devdocs/`**

### Before Writing Any Code:
1. **Consult [Documentation Index](./devdocs/index.md)** for relevant technology guides
2. **Follow patterns and examples** from the appropriate documentation files
3. **Use healthcare-specific implementations** rather than generic solutions
4. **Implement security and HIPAA compliance** as documented

### Key Documentation References:
- **[React 18](./devdocs/react-18.md)** - Component patterns, hooks, performance optimization
- **[TypeScript](./devdocs/typescript.md)** - Type definitions, domain modeling, validation
- **[Express.js](./devdocs/express.md)** - API patterns, security, healthcare compliance
- **[SQLite](./devdocs/sqlite-better-sqlite3.md)** - Database design, performance, medical data
- **[Forms](./devdocs/react-hook-form.md)** + **[Validation](./devdocs/zod.md)** - Medical form patterns
- **[Testing](./devdocs/jest.md)** + **[Components](./devdocs/react-testing-library.md)** - TDD practices

### Documentation-First Development:
- **Never implement without consulting docs** - Each file contains production-ready patterns
- **Copy and adapt examples** - All code examples are healthcare-focused and tested
- **Follow naming conventions** - Use established patterns from documentation  
- **Implement accessibility** - Follow WCAG guidelines documented in each file

## Core Development Principles

### 1. Test-Driven Development (TDD) - MANDATORY
**ALWAYS write tests BEFORE implementing features:**
1. Write failing tests first
2. Write minimal code to make tests pass
3. Refactor and optimize while keeping tests green
4. Never skip the test-first approach

**Test Coverage Requirements:**
- Unit tests: Minimum 80% coverage
- Integration tests: All API endpoints
- E2E tests: Critical user journeys
- Run tests after EVERY change

### 2. Simplicity First
- Start with the simplest solution that works
- Optimize only when tests prove the need
- Avoid premature optimization
- Use proven libraries, don't reinvent wheels
- Keep dependencies minimal

### 3. Iterative Development
- Complete each phase fully before moving to next
- Run all tests at phase completion
- Optimize code after tests pass
- Document learnings for next phase

## Tech Stack Reference
- **Backend**: Node.js, Express, TypeScript, SQLite (better-sqlite3)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Testing**: Jest, React Testing Library, Playwright
- **Auth**: JWT with bcrypt
- **Forms**: React Hook Form + Zod

## Agent Usage Guidelines

### ALWAYS Use Agents For:

1. **test-writer-fixer** - After ANY code changes
   - Automatically run after implementing features
   - Fix failing tests while maintaining test integrity
   - Ensure comprehensive test coverage

2. **rapid-prototyper** - For new features/components
   - Scaffold new modules quickly
   - Create boilerplate with best practices
   - Set up initial test structure

3. **backend-architect** - For API and database work
   - Design RESTful endpoints
   - Optimize database queries
   - Implement secure authentication

4. **frontend-developer** - For UI components
   - Build responsive interfaces
   - Implement React components
   - Handle state management

5. **performance-benchmarker** - After each phase
   - Test load times and response speeds
   - Identify bottlenecks
   - Suggest optimizations

6. **security-analyzer** - Before phase completion
   - Check for vulnerabilities
   - Validate authentication/authorization
   - Ensure data protection

## Development Workflow

### For Each Feature:
1. **Plan** → Use sprint-prioritizer agent
2. **Write Tests** → Use test-writer-fixer agent
3. **Implement** → Use appropriate development agent
4. **Test** → Run test-writer-fixer agent
5. **Optimize** → Use performance-benchmarker agent
6. **Secure** → Run security checks
7. **Document** → Update relevant documentation

## Testing Commands
```bash
# Backend tests
cd backend
npm test                 # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:coverage   # Coverage report

# Frontend tests  
cd frontend
npm test                # Run all tests
npm run test:unit      # Component tests
npm run test:e2e       # End-to-end tests

# Full test suite
npm run test:all       # Runs all tests across projects
```

## Code Style Guidelines

### 🔗 FOLLOW DOCUMENTATION PATTERNS
**All code must follow patterns established in `/devdocs/` - DO NOT create custom patterns**

### Backend (Node.js/TypeScript)
- **Follow [Express.js patterns](./devdocs/express.md)** - Repository pattern, middleware, error handling
- **Use [TypeScript healthcare types](./devdocs/typescript.md)** - Patient, Service, User interfaces
- **Implement [SQLite best practices](./devdocs/sqlite-better-sqlite3.md)** - Transactions, prepared statements
- **Copy API endpoint structures** from Express.js documentation examples
- Type everything with healthcare domain types, avoid 'any'

### Frontend (React/TypeScript)
- **Follow [React 18 patterns](./devdocs/react-18.md)** - Hooks, performance, error boundaries
- **Use [shadcn/ui components](./devdocs/shadcn-ui.md)** - Never create custom UI components
- **Implement [Tailwind classes](./devdocs/tailwind.md)** - Healthcare color palette, responsive design
- **Copy component structures** from React documentation examples
- Accessible by default following documented ARIA patterns

### Forms and Validation
- **Use [React Hook Form patterns](./devdocs/react-hook-form.md)** - Medical form structures, validation
- **Implement [Zod schemas](./devdocs/zod.md)** - Healthcare data validation, custom validators
- **Never create custom validation** - Use documented medical validation patterns
- Auto-save and error handling as documented

### Database (SQLite)
- **Follow [SQLite patterns](./devdocs/sqlite-better-sqlite3.md)** - Schema design, performance optimization
- **Use documented migrations** - Healthcare table structures and indexes
- **Implement audit logging** as shown in database documentation
- **Copy repository patterns** - BaseRepository and domain-specific repositories

## Phase-Specific Guidelines

### 📖 Each Phase MUST Follow Documentation Patterns

### Phase 1: Authentication
- **Use [Express.js auth patterns](./devdocs/express.md)** - JWT middleware, rate limiting, security
- **Implement [TypeScript user types](./devdocs/typescript.md)** - User, Role, Permission interfaces  
- **Follow [Jest testing](./devdocs/jest.md)** - Authentication endpoint testing patterns
- Test token expiry and refresh using documented test patterns

### Phase 2: Database Schema  
- **Use [SQLite schema patterns](./devdocs/sqlite-better-sqlite3.md)** - Healthcare tables, indexes, constraints
- **Implement [TypeScript domain models](./devdocs/typescript.md)** - Patient, Service, User types
- **Copy migration patterns** from SQLite documentation
- Test cascade deletes using documented repository patterns

### Phase 3: Candidate Portal
- **Use [React 18 patterns](./devdocs/react-18.md)** - Custom hooks, error boundaries, performance
- **Implement [Tailwind responsive](./devdocs/tailwind.md)** - Mobile-first healthcare UI patterns
- **Use [React Hook Form](./devdocs/react-hook-form.md)** - Real-time validation, auto-save patterns
- **Follow [shadcn/ui examples](./devdocs/shadcn-ui.md)** - Patient forms, status displays

### Phase 4-5: Admin Portal  
- **Copy [shadcn/ui admin patterns](./devdocs/shadcn-ui.md)** - Data tables, dashboard layouts
- **Use [SQLite audit patterns](./devdocs/sqlite-better-sqlite3.md)** - Audit logging, bulk operations
- **Implement [React performance](./devdocs/react-18.md)** - Pagination, search optimization
- **Follow [Express.js patterns](./devdocs/express.md)** - Admin API endpoints, permissions

### Phase 6: Dynamic Fields
- **Use [Zod dynamic schemas](./devdocs/zod.md)** - Conditional validation, field dependencies  
- **Implement [React Hook Form arrays](./devdocs/react-hook-form.md)** - Dynamic field management
- **Copy [TypeScript conditional types](./devdocs/typescript.md)** - Dynamic type safety
- Performance test using documented benchmarking patterns

### Phase 7: Reporting
- **Use [SQLite optimization](./devdocs/sqlite-better-sqlite3.md)** - Query optimization, indexes
- **Implement [Express.js caching](./devdocs/express.md)** - Response caching, streaming  
- **Follow [React performance](./devdocs/react-18.md)** - Large dataset rendering
- Background jobs using documented async patterns

### Phase 8: Production
- **Security audit using [all documentation](./devdocs/index.md)** - Comprehensive security checklist
- **Performance benchmarks per docs** - Meet documented performance targets
- **Accessibility per [component docs](./devdocs/shadcn-ui.md)** - WCAG 2.1 AA compliance
- Complete documentation updates following established patterns

## Common Patterns

### 🚨 USE DOCUMENTED PATTERNS ONLY - DO NOT INVENT NEW ONES

### API Endpoints
```typescript
// COPY from Express.js documentation - healthcare endpoints with validation
GET    /api/patients           // List patients with pagination
GET    /api/patients/:id       // Single patient with services  
POST   /api/patients           // Create with Zod validation
PUT    /api/patients/:id       // Update with audit logging
DELETE /api/patients/:id       // Soft delete with audit trail

// See Express.js docs for complete endpoint examples with:
// - Authentication middleware
// - Validation middleware  
// - Error handling
// - Audit logging
// - HIPAA compliance
```

### Error Handling
```typescript
// COPY from Express.js documentation - healthcare error format
{
  success: false,
  error: {
    code: 'PATIENT_NOT_FOUND' | 'VALIDATION_ERROR' | 'UNAUTHORIZED',
    message: 'User-friendly message',
    timestamp: '2023-12-01T10:00:00Z',
    details?: {} // NO sensitive patient data in errors
  }
}

// See Express.js docs for complete error handling patterns
```

### Component Structure  
```typescript
// COPY from React documentation - healthcare component organization
PatientCard/
  ├── PatientCard.tsx              // Main component (shadcn/ui + Tailwind)
  ├── PatientCard.test.tsx         // React Testing Library tests
  ├── PatientCard.types.ts         // TypeScript interfaces
  ├── PatientCard.stories.tsx      // Storybook stories (optional)
  └── index.ts                    // Export

// See React 18 docs for complete component patterns with:
// - Performance optimization (React.memo, useMemo)  
// - Error boundaries
// - Accessibility (ARIA labels)
// - Healthcare-specific prop types
```

### Form Patterns
```typescript
// COPY from React Hook Form + Zod documentation
// Patient registration form with:
// - Real-time validation
// - Auto-save functionality  
// - Accessibility compliance
// - Medical data validation
// - HIPAA-safe error handling

// See React Hook Form docs for complete form examples
```

### Database Patterns
```typescript
// COPY from SQLite documentation - healthcare repository pattern
class PatientRepository extends BaseRepository<Patient> {
  // Audit logging, soft deletes, medical record validation
  // See SQLite docs for complete repository implementations
}

// Healthcare-specific schemas and migrations
// See SQLite docs for medical data table designs
```

## Performance Targets
- Page load: < 2 seconds
- API response: < 200ms
- Form submission: < 1 second
- Search results: < 500ms
- Export generation: < 5 seconds

## Security Checklist
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (sanitize output)
- [ ] CSRF tokens implemented
- [ ] Rate limiting active
- [ ] Passwords hashed with bcrypt
- [ ] JWT secrets properly managed
- [ ] HTTPS only in production

## Debugging Tips
1. Check test output first - tests often reveal the issue
2. Use SQLite browser to inspect database state
3. React DevTools for component state debugging
4. Network tab for API request/response issues
5. Console.log is fine during development, remove before commit

## Quick Commands Reference
```bash
# Development
npm run dev           # Start dev servers
npm run build        # Build for production
npm run lint         # Run linters
npm run format       # Format code

# Database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed dev data
npm run db:reset     # Reset database

# Testing
npm test            # Run tests
npm run test:watch  # Watch mode
npm run test:debug  # Debug mode
```

## When Stuck

### 📚 DOCUMENTATION-FIRST PROBLEM SOLVING
1. **Search [Documentation Index](./devdocs/index.md)** for relevant patterns
2. **Find similar examples** in the appropriate documentation file
3. **Copy and adapt** the documented healthcare-specific solution
4. **Run tests** using documented testing patterns
5. **Check phase requirements** against documented implementation guides

### If Still Stuck:
1. Run tests to identify what's broken (use [Jest patterns](./devdocs/jest.md))
2. Check the plan.md for phase requirements 
3. Use appropriate agent for help
4. Simplify the problem using documented simple-first patterns
5. Add more tests using [React Testing Library patterns](./devdocs/react-testing-library.md)

## Remember

### 🎯 DOCUMENTATION-DRIVEN DEVELOPMENT
- **Check documentation BEFORE writing any code**
- **Copy documented patterns instead of inventing new ones**
- **Use healthcare-specific examples, not generic solutions**  
- **Follow established naming conventions and structures**
- **Implement documented security and accessibility patterns**

### Core Principles
- **Write tests first using [documented testing patterns](./devdocs/jest.md)**
- **Keep it simple using [documented simple-first approaches](./devdocs/index.md)**
- **Use agents to accelerate development with documented patterns**
- **Optimize only with evidence from documented benchmarking**
- **Every line of code should follow documented healthcare patterns**
- **If it's not tested with documented patterns, it's broken**

## Project-Specific Agents to Prioritize

### 📚 ALL AGENTS MUST USE DOCUMENTATION PATTERNS

1. **test-writer-fixer** - Use [Jest](./devdocs/jest.md) + [React Testing Library](./devdocs/react-testing-library.md) patterns
2. **rapid-prototyper** - Scaffold using [documented component structures](./devdocs/index.md)  
3. **backend-architect** - Follow [Express.js](./devdocs/express.md) + [SQLite](./devdocs/sqlite-better-sqlite3.md) patterns
4. **frontend-developer** - Use [React 18](./devdocs/react-18.md) + [shadcn/ui](./devdocs/shadcn-ui.md) patterns
5. **performance-benchmarker** - Benchmark against [documented performance targets](./devdocs/index.md)
6. **sprint-prioritizer** - Plan using [phase-specific documentation guides](./devdocs/index.md)

### Agent Instructions:
- **Always reference [Documentation Index](./devdocs/index.md)** before starting work
- **Copy documented examples** rather than creating new patterns
- **Use healthcare-specific implementations** from documentation
- **Follow documented testing strategies** for all code
- **Implement documented security and accessibility patterns**

---

## 🚨 CRITICAL REMINDERS

### MANDATORY DOCUMENTATION USAGE:
1. **NEVER write code without consulting relevant documentation**  
2. **ALWAYS use healthcare-specific examples from docs**
3. **ALWAYS follow documented patterns and naming conventions**
4. **ALWAYS implement documented security and accessibility measures**
5. **ALWAYS use documented testing patterns and examples**

### Documentation Updates:
- **Update documentation when adding new patterns**
- **Add healthcare-specific examples for new use cases**  
- **Document security considerations for new features**
- **Include test coverage examples for new patterns**

*This document should be referenced throughout development. The `/devdocs/` directory contains the authoritative technical patterns that MUST be followed. Update both this file and the documentation with lessons learned during implementation.*