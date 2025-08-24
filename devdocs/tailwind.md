# Tailwind CSS Documentation for Healthcare Service Log Portal

## Overview
Tailwind CSS is a utility-first CSS framework that enables rapid UI development with consistent design patterns, perfect for healthcare applications requiring clean, professional interfaces.

## Installation and Setup

### With Vite (Recommended)
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Configuration
```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Healthcare color palette
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        medical: {
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          800: '#262626',
          900: '#171717',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
```

## Core Utility Classes

### Layout and Spacing
```html
<!-- Patient Dashboard Layout -->
<div class="min-h-screen bg-neutral-50">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b border-neutral-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <h1 class="text-2xl font-semibold text-neutral-900">Healthcare Portal</h1>
        <div class="flex items-center space-x-4">
          <button class="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
            New Patient
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Patient List -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-neutral-200">
            <h2 class="text-lg font-medium text-neutral-900">Patient List</h2>
          </div>
          <div class="divide-y divide-neutral-200">
            <!-- Patient entries -->
          </div>
        </div>
      </div>
      
      <!-- Patient Details -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h3 class="text-lg font-medium text-neutral-900 mb-4">Patient Details</h3>
          <!-- Patient information -->
        </div>
      </div>
    </div>
  </main>
</div>
```

### Typography
```html
<!-- Healthcare Content Typography -->
<div class="prose prose-neutral max-w-none">
  <h1 class="text-3xl font-bold text-neutral-900 mb-2">Patient Records</h1>
  <p class="text-lg text-neutral-600 mb-6">Manage and track patient service history</p>
  
  <!-- Service Entry -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-neutral-800 mb-3">Recent Services</h2>
    <div class="text-sm text-neutral-600">
      <p class="mb-2">Last updated: <span class="font-medium">2 hours ago</span></p>
    </div>
  </div>
  
  <!-- Status Text -->
  <div class="flex items-center space-x-2">
    <span class="text-xs font-medium text-medical-success">Active</span>
    <span class="text-sm text-neutral-500">•</span>
    <span class="text-sm text-neutral-600">Next appointment: Tomorrow</span>
  </div>
</div>
```

### Form Components
```html
<!-- Patient Registration Form -->
<form class="space-y-6 max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-neutral-200">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- First Name -->
    <div>
      <label class="block text-sm font-medium text-neutral-700 mb-2" for="firstName">
        First Name *
      </label>
      <input
        type="text"
        id="firstName"
        name="firstName"
        required
        class="block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Enter first name"
      />
    </div>

    <!-- Last Name -->
    <div>
      <label class="block text-sm font-medium text-neutral-700 mb-2" for="lastName">
        Last Name *
      </label>
      <input
        type="text"
        id="lastName"
        name="lastName"
        required
        class="block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Enter last name"
      />
    </div>
  </div>

  <!-- Email -->
  <div>
    <label class="block text-sm font-medium text-neutral-700 mb-2" for="email">
      Email Address
    </label>
    <input
      type="email"
      id="email"
      name="email"
      class="block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      placeholder="patient@example.com"
    />
  </div>

  <!-- Phone -->
  <div>
    <label class="block text-sm font-medium text-neutral-700 mb-2" for="phone">
      Phone Number *
    </label>
    <input
      type="tel"
      id="phone"
      name="phone"
      required
      class="block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      placeholder="(555) 123-4567"
    />
  </div>

  <!-- Submit Button -->
  <div class="flex justify-end space-x-4 pt-6 border-t border-neutral-200">
    <button
      type="button"
      class="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-500 transition-colors"
    >
      Cancel
    </button>
    <button
      type="submit"
      class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
    >
      Save Patient
    </button>
  </div>
</form>
```

### Status and Alert Components
```html
<!-- Status Badges -->
<div class="flex items-center space-x-2 mb-4">
  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-medical-success bg-opacity-10 text-medical-success">
    Active
  </span>
  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-medical-warning bg-opacity-10 text-medical-warning">
    Pending
  </span>
  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-medical-error bg-opacity-10 text-medical-error">
    Cancelled
  </span>
</div>

<!-- Alert Messages -->
<div class="mb-6">
  <!-- Success Alert -->
  <div class="bg-medical-success bg-opacity-10 border border-medical-success border-opacity-20 text-medical-success px-4 py-3 rounded-lg mb-4">
    <div class="flex items-center">
      <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>
      <span class="font-medium">Patient record saved successfully</span>
    </div>
  </div>

  <!-- Error Alert -->
  <div class="bg-medical-error bg-opacity-10 border border-medical-error border-opacity-20 text-medical-error px-4 py-3 rounded-lg mb-4">
    <div class="flex items-center">
      <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <div>
        <span class="font-medium">Error saving patient record</span>
        <p class="text-sm mt-1">Please check all required fields and try again.</p>
      </div>
    </div>
  </div>
</div>
```

### Data Display Components
```html
<!-- Patient Information Card -->
<div class="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
  <div class="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-neutral-900">Patient Information</h3>
      <button class="text-primary-600 hover:text-primary-700 text-sm font-medium">
        Edit
      </button>
    </div>
  </div>
  
  <div class="px-6 py-4">
    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <dt class="text-sm font-medium text-neutral-500">Full Name</dt>
        <dd class="text-sm text-neutral-900 mt-1">John Doe</dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-neutral-500">Date of Birth</dt>
        <dd class="text-sm text-neutral-900 mt-1">January 15, 1985</dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-neutral-500">Phone</dt>
        <dd class="text-sm text-neutral-900 mt-1">(555) 123-4567</dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-neutral-500">Email</dt>
        <dd class="text-sm text-neutral-900 mt-1">john.doe@example.com</dd>
      </div>
    </dl>
  </div>
</div>

<!-- Service History Table -->
<div class="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
  <div class="px-6 py-4 border-b border-neutral-200">
    <h3 class="text-lg font-medium text-neutral-900">Service History</h3>
  </div>
  
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-neutral-200">
      <thead class="bg-neutral-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Date
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Service Type
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Provider
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Status
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-neutral-200">
        <tr class="hover:bg-neutral-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
            Dec 15, 2023
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
            Consultation
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
            Dr. Smith
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-medical-success bg-opacity-10 text-medical-success">
              Completed
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

## Responsive Design

### Mobile-First Approach
```html
<!-- Responsive Patient Dashboard -->
<div class="min-h-screen bg-neutral-50">
  <!-- Mobile Header -->
  <header class="bg-white shadow-sm border-b border-neutral-200 lg:hidden">
    <div class="flex items-center justify-between px-4 py-4">
      <h1 class="text-xl font-semibold text-neutral-900">Patients</h1>
      <button class="p-2 rounded-lg border border-neutral-300">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Responsive Grid -->
  <main class="max-w-7xl mx-auto p-4 lg:py-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
      <!-- Sidebar - Hidden on mobile, sidebar on desktop -->
      <div class="hidden lg:block lg:col-span-1">
        <!-- Filters and navigation -->
      </div>
      
      <!-- Main Content - Full width on mobile, 3/4 on desktop -->
      <div class="lg:col-span-3">
        <!-- Patient list with responsive cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
            <!-- Patient card content -->
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

### Breakpoint Classes
```html
<!-- Responsive Form Layout -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  <!-- Mobile: 1 column, Small: 2 columns, Large: 3 columns, XL: 4 columns -->
</div>

<!-- Responsive Text Sizes -->
<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Healthcare Portal
</h1>

<!-- Responsive Spacing -->
<div class="p-4 sm:p-6 lg:p-8">
  <!-- Padding increases with screen size -->
</div>

<!-- Responsive Hiding/Showing -->
<div class="block sm:hidden">Mobile only content</div>
<div class="hidden sm:block lg:hidden">Tablet only content</div>
<div class="hidden lg:block">Desktop only content</div>
```

## Dark Mode Support

### Configuration
```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a1a',
          surface: '#262626',
          border: '#404040',
          text: '#e5e5e5',
        }
      }
    }
  }
}
```

### Implementation
```html
<!-- Dark mode toggle -->
<div class="bg-white dark:bg-dark-bg text-neutral-900 dark:text-dark-text min-h-screen">
  <header class="bg-white dark:bg-dark-surface border-b border-neutral-200 dark:border-dark-border">
    <div class="flex items-center justify-between p-4">
      <h1 class="text-xl font-semibold">Healthcare Portal</h1>
      
      <!-- Dark mode toggle button -->
      <button class="p-2 rounded-lg bg-neutral-100 dark:bg-dark-surface hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
        <!-- Light mode icon (show in dark mode) -->
        <svg class="w-5 h-5 hidden dark:block" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
        </svg>
        
        <!-- Dark mode icon (show in light mode) -->
        <svg class="w-5 h-5 block dark:hidden" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
        </svg>
      </button>
    </div>
  </header>
  
  <!-- Form with dark mode styles -->
  <main class="p-6">
    <div class="bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-neutral-200 dark:border-dark-border p-6">
      <h2 class="text-lg font-medium text-neutral-900 dark:text-dark-text mb-4">
        Patient Information
      </h2>
      
      <input
        type="text"
        class="block w-full px-3 py-2 border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-bg text-neutral-900 dark:text-dark-text rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Enter name"
      />
    </div>
  </main>
</div>
```

## Performance Optimization

### Purging Unused CSS
```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  // Tailwind will only generate CSS for classes found in these files
}
```

### Custom CSS for Complex Components
```css
/* src/styles/components.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors;
  }
  
  .card {
    @apply bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden;
  }
  
  .form-input {
    @apply block w-full px-3 py-2 border border-neutral-300 rounded-lg shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent;
  }
  
  .table-header {
    @apply px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider;
  }
}
```

## Accessibility Features

### Screen Reader Support
```html
<!-- Form with proper labels and descriptions -->
<div>
  <label class="block text-sm font-medium text-neutral-700 mb-2" for="patient-phone">
    Phone Number
    <span class="text-medical-error" aria-label="required">*</span>
  </label>
  <input
    type="tel"
    id="patient-phone"
    name="phone"
    required
    aria-describedby="phone-help phone-error"
    class="form-input"
    placeholder="(555) 123-4567"
  />
  <p id="phone-help" class="text-xs text-neutral-500 mt-1">
    Enter 10-digit phone number
  </p>
  <p id="phone-error" class="text-xs text-medical-error mt-1 hidden">
    Please enter a valid phone number
  </p>
</div>

<!-- Status with proper ARIA attributes -->
<div
  role="status"
  aria-live="polite"
  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-medical-success bg-opacity-10 text-medical-success"
>
  <span class="sr-only">Status:</span>
  Active
</div>
```

### Focus Management
```css
/* Enhanced focus styles */
@layer utilities {
  .focus-visible {
    @apply focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2;
  }
}
```

## Testing Utilities

### Test-Friendly Classes
```html
<!-- Add test IDs that don't affect styling -->
<button
  data-testid="save-patient-btn"
  class="btn-primary"
  type="submit"
>
  Save Patient
</button>

<div
  data-testid="patient-card"
  class="card p-6"
>
  <!-- Patient information -->
</div>
```

## Common Patterns and Best Practices

1. **Consistent Spacing**: Use the spacing scale (4, 8, 16, 24, 32px)
2. **Color Semantics**: Use medical color palette for status indicators
3. **Responsive Design**: Mobile-first approach with breakpoint progression
4. **Accessibility**: Always include proper ARIA labels and focus styles
5. **Performance**: Use `@layer` directive for custom components
6. **Dark Mode**: Plan for dark mode from the start
7. **Component Classes**: Create reusable component classes for complex patterns

## Resources
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com)
- [Accessibility Guide](https://tailwindcss.com/docs/screen-readers)