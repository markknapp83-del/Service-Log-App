# Healthcare Service Log Portal - Accessibility Test Suite

This comprehensive accessibility test suite ensures WCAG 2.1 AA compliance and healthcare-specific accessibility requirements for the Healthcare Service Log Portal.

## 🎯 Overview

The accessibility test suite validates:
- **WCAG 2.1 AA Compliance**: Meeting international web accessibility standards
- **Healthcare-Specific Requirements**: Medical device compatibility, HIPAA compliance, emergency workflows
- **Comprehensive Coverage**: All interactive elements, forms, navigation, and data presentation

## 📋 Test Categories

### 1. Keyboard Navigation Tests (`KeyboardNavigation.test.tsx`)
- **Tab Order**: Logical sequence through all interactive elements
- **Focus Management**: Proper focus indicators and trapping in modals
- **Keyboard Shortcuts**: Standard browser shortcuts and custom hotkeys
- **Form Navigation**: Multi-step forms and dynamic content
- **Table Navigation**: Arrow key navigation through data tables

### 2. Screen Reader Support Tests (`ScreenReaderSupport.test.tsx`)
- **ARIA Labels**: All interactive elements properly labeled
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **Live Regions**: Dynamic content announcements
- **Table Structure**: Headers, captions, and data relationships
- **Form Announcements**: Validation errors and state changes

### 3. Color Contrast and Visual Tests (`ColorContrastVisual.test.tsx`)
- **WCAG AA Contrast**: 4.5:1 ratio for normal text, 3:1 for large text
- **Healthcare Enhancement**: 7:1 ratio for critical medical information
- **Color Independence**: Information not conveyed by color alone
- **High Contrast Mode**: Compatibility with system preferences
- **Focus Indicators**: Visible focus rings for all interactive elements

### 4. Form Accessibility Tests (`FormAccessibility.test.tsx`)
- **Label Association**: All form controls properly labeled
- **Error Handling**: Accessible validation messages and recovery
- **Required Fields**: Clear indicators and announcements
- **Help Text**: Contextual guidance properly associated
- **Dynamic Forms**: Accessible generation of patient entries

### 5. Component-Specific Tests (`ComponentAccessibility.test.tsx`)
- **Buttons**: All variants and states (loading, disabled, focus)
- **Inputs**: Text fields, selects, date pickers with full accessibility
- **Tables**: Sorting, filtering, pagination with keyboard support
- **Modals**: Focus trapping, escape handling, proper ARIA attributes
- **Tabs**: ARIA tabpanel pattern with keyboard navigation

### 6. Healthcare-Specific Tests (`HealthcareAccessibility.test.tsx`)
- **HIPAA Compliance**: No sensitive data exposure in errors or logs
- **Medical Workflows**: Multi-patient forms, emergency actions
- **Device Compatibility**: Touch targets for medical tablets (44px minimum)
- **Emergency Actions**: Enhanced accessibility (56px touch targets, high contrast)
- **Medical Terminology**: Screen reader pronunciation guides

## 🛠️ Test Utilities

### Core Utilities (`AccessibilityTestUtils.tsx`)

```typescript
// Render components with accessibility context
renderWithA11yContext(
  <ComponentToTest />,
  { 
    user: mockUser,
    highContrast: true,
    reducedMotion: true 
  }
);

// Run axe-core accessibility tests
await a11yTestUtils.runA11yTests(container);

// Verify keyboard navigation
await a11yTestUtils.verifyKeyboardNavigation(elements);

// Check HIPAA compliance (no sensitive data)
a11yTestUtils.checkForSensitiveData(errorMessage);

// Test healthcare-specific scenarios
await healthcareA11yScenarios.testMedicalFormA11y(form);
```

### Healthcare Configuration

```typescript
const healthcareA11yConfig = {
  // Enhanced contrast for critical medical info
  contrastRatios: {
    normal: 4.5,    // WCAG AA standard
    large: 3.0,     // WCAG AA large text
    critical: 7.0,  // Enhanced for medical data
  },
  
  // Touch targets for medical devices
  touchTargetSizes: {
    minimum: 44,    // WCAG AA minimum
    preferred: 48,  // Healthcare standard
    critical: 56,   // Emergency actions
  },
  
  // Extended timeouts for medical workflows
  interactionTimeouts: {
    formSubmission: 30000,  // 30s for complex forms
    dataLoading: 10000,     // 10s for patient data
    emergencyActions: 5000, // 5s for emergency
  },
};
```

## 🏥 Healthcare-Specific Features

### HIPAA Compliance Testing
```typescript
// Automatically checks for sensitive data patterns
const sensitivePatterns = [
  /\b\d{3}-\d{2}-\d{4}\b/,  // SSN
  /\b[A-Z]{2}\d{6,8}\b/,    // Medical Record Number
  /patient.*\d+/i,          // Patient ID references
];

// Usage
a11yTestUtils.checkForSensitiveData(errorMessage);
```

### Emergency Action Accessibility
```typescript
// Enhanced requirements for critical healthcare actions
await a11yTestUtils.verifyEmergencyActionAccessibility(emergencyButton);
// Verifies:
// - 56px minimum touch target
// - High contrast ratios
// - Clear ARIA labels with urgency indicators
// - Keyboard accessibility
```

### Medical Device Compatibility
```typescript
// Test high contrast mode for medical displays
renderWithA11yContext(<Component />, { highContrast: true });

// Verify touch targets for medical tablets
a11yTestUtils.verifyTouchTargetSize(
  button, 
  healthcareA11yConfig.touchTargetSizes.minimum
);
```

## 🚀 Running Tests

### Command Line
```bash
# Run all accessibility tests
npm test -- --testPathPattern=accessibility

# Run specific test category
npm test -- KeyboardNavigation.test.tsx
npm test -- HealthcareAccessibility.test.tsx

# Run with coverage
npm run test:coverage -- --testPathPattern=accessibility

# Run in watch mode for development
npm test -- --testPathPattern=accessibility --watch

# Run specific test patterns
npm test -- --testNamePattern="WCAG 2.1 AA"
npm test -- --testNamePattern="healthcare"
```

### VS Code Integration
```json
// .vscode/settings.json
{
  "jest.testMatch": [
    "<rootDir>/src/tests/accessibility/**/*.test.{ts,tsx}"
  ]
}
```

## 📊 Coverage Requirements

### Minimum Coverage Targets
- **Keyboard Navigation**: 100% of interactive elements
- **Screen Reader**: All content properly labeled  
- **Color Contrast**: All text meets minimum ratios
- **Forms**: All fields validated for accessibility
- **Components**: Zero axe-core violations
- **Healthcare**: Full HIPAA compliance validation

### Test Results Interpretation
```bash
# Expected output format
✅ KeyboardNavigation.test.tsx
  - ServiceLogForm maintains logical tab order
  - Modal focus trapping works correctly
  - Table keyboard navigation supported

✅ HealthcareAccessibility.test.tsx  
  - Medical forms meet healthcare standards
  - HIPAA compliance verified (no sensitive data exposure)
  - Emergency actions highly accessible
```

## 🔧 Configuration

### Jest Setup
```typescript
// jest.config.js additions for accessibility testing
setupFilesAfterEnv: [
  '@testing-library/jest-dom',
  'jest-axe/extend-expect'
],
testEnvironment: 'jsdom',
```

### TypeScript Configuration
```typescript
// Include accessibility test utilities in tsconfig
"include": [
  "src/tests/accessibility/**/*"
]
```

## 🎨 Test Data and Mocks

### Mock Healthcare Data
```typescript
// Generates realistic test data
const mockPatient = createMockPatient({
  firstName: 'John',
  lastName: 'Doe',
  medicalRecordNumber: 'MR123456',
  emergencyContact: { name: 'Jane Doe', relationship: 'spouse' }
});

const mockServiceLog = createMockServiceLog({
  patientCount: 3,
  serviceDate: '2023-12-01',
  additionalNotes: 'Emergency consultation completed'
});
```

### Environment Simulation
```typescript
// Test different accessibility environments
renderWithA11yContext(<Component />, {
  reducedMotion: true,      // Respects prefers-reduced-motion
  highContrast: true,       // Simulates high contrast mode  
  screenReaderMode: true,   // Screen reader specific testing
  user: mockClinicianUser,  // Healthcare role testing
});
```

## 🔍 Debugging Failed Tests

### Common Issues and Solutions

1. **Axe Violations**
   ```typescript
   // Debug specific violations
   const results = await axe(container);
   console.log('Violations:', results.violations);
   ```

2. **Missing ARIA Labels**
   ```typescript
   // Check element accessibility
   const button = screen.getByRole('button');
   console.log('Accessible name:', button.accessibleName);
   console.log('ARIA attributes:', button.attributes);
   ```

3. **Focus Issues**
   ```typescript
   // Debug focus management
   console.log('Active element:', document.activeElement);
   console.log('Focus visible:', button.matches(':focus-visible'));
   ```

## 📝 Contributing to Tests

### Adding New Accessibility Tests
1. **Follow naming conventions**: `ComponentName.a11y.test.tsx`
2. **Use test utilities**: Import from `AccessibilityTestUtils`
3. **Cover all scenarios**: Happy path, error states, edge cases
4. **Healthcare context**: Consider medical workflows and HIPAA

### Test Structure Template
```typescript
describe('Component Accessibility - WCAG 2.1 AA', () => {
  test('meets basic accessibility requirements', async () => {
    renderWithA11yContext(<Component />);
    
    const container = screen.getByRole('main');
    await a11yTestUtils.runA11yTests(container);
    
    // Component-specific tests
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
  
  test('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithA11yContext(<Component />);
    
    await user.tab();
    // Verify focus behavior
  });
  
  test('healthcare-specific requirements', async () => {
    // Test medical workflow accessibility
    await healthcareA11yScenarios.testMedicalFormA11y(form);
  });
});
```

## 🏆 Success Criteria

This accessibility test suite ensures the Healthcare Service Log Portal:

✅ **Meets WCAG 2.1 AA Standards**
- Level A and AA success criteria compliance
- Automated testing with axe-core
- Manual testing scenarios covered

✅ **Supports All Users**
- Keyboard-only navigation
- Screen reader compatibility  
- High contrast mode support
- Reduced motion preferences

✅ **Healthcare Professional Ready**
- Medical device compatibility
- Emergency action accessibility
- Extended workflow timeouts
- HIPAA-compliant error handling

✅ **Production Quality**
- Zero accessibility regressions
- Comprehensive test coverage
- Continuous integration ready
- Performance benchmarked

## 📚 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Testing Library Accessibility](https://testing-library.com/docs/guide-which-query)
- [Jest Axe Documentation](https://github.com/nickcolley/jest-axe)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Medical Device Accessibility](https://www.fda.gov/medical-devices/software-medical-device-samd)

---

*This test suite ensures the Healthcare Service Log Portal is accessible to all healthcare professionals, regardless of their abilities or the assistive technologies they use.*