# React 18 Documentation for Healthcare Service Log Portal

## Overview
React 18 brings concurrent features and improved performance for building interactive healthcare applications.

## Core Concepts

### Functional Components with Hooks
```javascript
import React, { useState, useEffect } from 'react';

function PatientDashboard({ patientId }) {
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatientData(patientId)
      .then(setPatientData)
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="patient-dashboard">
      <PatientInfo data={patientData} />
      <ServiceLog entries={patientData.services} />
    </div>
  );
}
```

### State Management Patterns

#### Local State with useState
```javascript
function ServiceForm() {
  const [formData, setFormData] = useState({
    serviceType: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleInputChange = (field) => (value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <ServiceTypeSelect 
        value={formData.serviceType}
        onChange={handleInputChange('serviceType')}
      />
      <DateInput 
        value={formData.date}
        onChange={handleInputChange('date')}
      />
      <NotesTextarea 
        value={formData.notes}
        onChange={handleInputChange('notes')}
      />
    </form>
  );
}
```

#### Lifting State Up for Shared Data
```javascript
function AdminDashboard() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <div className="admin-dashboard">
      <PatientList 
        patients={patients}
        onSelect={setSelectedPatient}
        selectedId={selectedPatient?.id}
      />
      <PatientDetails 
        patient={selectedPatient}
        onUpdate={handlePatientUpdate}
      />
    </div>
  );
}
```

### Custom Hooks for Reusable Logic
```javascript
// useAuth hook for authentication state
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const user = await authenticate(credentials);
    setUser(user);
    return user;
  };

  const logout = () => {
    setUser(null);
    clearAuthToken();
  };

  return { user, loading, login, logout };
}

// useApi hook for data fetching
function useApi(endpoint, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    fetchData(endpoint)
      .then(result => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, dependencies);

  return { data, loading, error };
}
```

### Performance Optimization

#### React.memo for Component Memoization
```javascript
const ServiceEntry = React.memo(({ entry, onUpdate }) => {
  return (
    <div className="service-entry">
      <h3>{entry.serviceType}</h3>
      <p>{entry.date}</p>
      <p>{entry.notes}</p>
      <EditButton onClick={() => onUpdate(entry.id)} />
    </div>
  );
});

// Only re-render if entry changes
const MemoizedServiceEntry = React.memo(ServiceEntry, (prevProps, nextProps) => {
  return prevProps.entry.id === nextProps.entry.id &&
         prevProps.entry.updatedAt === nextProps.entry.updatedAt;
});
```

#### useCallback for Function Memoization
```javascript
function PatientList({ patients, onPatientSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const handlePatientClick = useCallback((patientId) => {
    onPatientSelect(patientId);
    trackEvent('patient_selected', { patientId });
  }, [onPatientSelect]);

  const filteredPatients = useMemo(() => {
    return patients.filter(patient => 
      patient.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [patients, searchTerm]);

  return (
    <div>
      <SearchInput value={searchTerm} onChange={setSearchTerm} />
      {filteredPatients.map(patient => (
        <PatientCard
          key={patient.id}
          patient={patient}
          onClick={handlePatientClick}
        />
      ))}
    </div>
  );
}
```

### Error Boundaries
```javascript
class ServiceLogErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('ServiceLog Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong with the service log</h2>
          <p>We've logged the error and will fix it soon.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Form Handling Best Practices
```javascript
function PatientRegistrationForm() {
  const [formState, setFormState] = useState({
    values: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
      email: ''
    },
    errors: {},
    touched: {}
  });

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        return !value.includes('@') ? 'Invalid email' : '';
      case 'phone':
        return !/^\d{10}$/.test(value) ? 'Invalid phone number' : '';
      default:
        return !value.trim() ? 'This field is required' : '';
    }
  };

  const handleFieldChange = (name) => (value) => {
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      errors: { ...prev.errors, [name]: validateField(name, value) }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    const errors = {};
    Object.keys(formState.values).forEach(field => {
      errors[field] = validateField(field, formState.values[field]);
    });

    if (Object.values(errors).some(error => error)) {
      setFormState(prev => ({ ...prev, errors, touched: {...prev.values} }));
      return;
    }

    try {
      await submitPatientRegistration(formState.values);
      // Handle success
    } catch (error) {
      // Handle API errors
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields with validation */}
    </form>
  );
}
```

## React 18 Concurrent Features

### Automatic Batching
```javascript
// React 18 automatically batches these updates
function handlePatientUpdate() {
  setPatientName(newName);
  setPatientPhone(newPhone);
  setLastUpdated(Date.now());
  // All updates batched into single re-render
}
```

### Suspense for Data Fetching
```javascript
function PatientDashboard({ patientId }) {
  return (
    <Suspense fallback={<PatientSkeleton />}>
      <PatientDetails patientId={patientId} />
      <Suspense fallback={<ServiceLogSkeleton />}>
        <ServiceLog patientId={patientId} />
      </Suspense>
    </Suspense>
  );
}
```

## Testing with React Testing Library
```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('patient registration form validation', async () => {
  const mockSubmit = jest.fn();
  render(<PatientRegistrationForm onSubmit={mockSubmit} />);

  const emailInput = screen.getByLabelText(/email/i);
  
  await userEvent.type(emailInput, 'invalid-email');
  fireEvent.blur(emailInput);

  await waitFor(() => {
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });

  expect(mockSubmit).not.toHaveBeenCalled();
});
```

## Best Practices for Healthcare Applications

1. **Accessibility First**: Use semantic HTML and ARIA labels
2. **Data Privacy**: Never log sensitive patient data
3. **Error Handling**: Graceful degradation for network failures
4. **Performance**: Lazy load non-critical components
5. **Security**: Validate all inputs, sanitize outputs
6. **Testing**: Test user interactions, not implementation details

## Common Patterns

### Protected Routes
```javascript
function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  
  if (!user || !user.roles.includes(requiredRole)) {
    return <Navigate to="/login" />;
  }

  return children;
}
```

### Data Fetching with Error Handling
```javascript
function usePatientData(patientId) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!patientId) return;

    const controller = new AbortController();
    
    fetchPatientData(patientId, { signal: controller.signal })
      .then(data => setState({ data, loading: false, error: null }))
      .catch(error => {
        if (!controller.signal.aborted) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => controller.abort();
  }, [patientId]);

  return state;
}
```

## Resources
- [React Official Documentation](https://react.dev)
- [React 18 Working Group](https://github.com/reactwg/react-18)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)