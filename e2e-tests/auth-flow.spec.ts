// E2E tests for authentication flow following Playwright documentation patterns
import { test, expect } from '@playwright/test';

// Demo user credentials
const ADMIN_USER = {
  email: 'admin@healthcare.local',
  password: 'admin123'
};

const CANDIDATE_USER = {
  email: 'candidate@healthcare.local',
  password: 'candidate123'
};

test.describe('Healthcare Portal Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should display login page for unauthenticated users', async ({ page }) => {
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
    
    // Check login form elements
    await expect(page.getByText('Healthcare Portal')).toBeVisible();
    await expect(page.getByText('Sign in to your account')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    
    // Check demo credentials are displayed
    await expect(page.getByText('Demo Accounts:')).toBeVisible();
    await expect(page.getByText('admin@healthcare.local')).toBeVisible();
    await expect(page.getByText('candidate@healthcare.local')).toBeVisible();
  });

  test('should login successfully with admin credentials', async ({ page }) => {
    // Fill login form
    await page.getByLabel('Email address').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    
    // Submit form
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Check dashboard elements
    await expect(page.getByText('Healthcare Portal')).toBeVisible();
    await expect(page.getByText('Welcome, System Administrator')).toBeVisible();
    await expect(page.getByText('admin')).toBeVisible(); // Role badge
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    
    // Check admin-specific content
    await expect(page.getByText('Admin Tools')).toBeVisible();
    await expect(page.getByText('User Management')).toBeVisible();
  });

  test('should login successfully with candidate credentials', async ({ page }) => {
    // Fill login form
    await page.getByLabel('Email address').fill(CANDIDATE_USER.email);
    await page.getByLabel('Password').fill(CANDIDATE_USER.password);
    
    // Submit form
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Check dashboard elements
    await expect(page.getByText('Welcome, Test Candidate')).toBeVisible();
    await expect(page.getByText('candidate')).toBeVisible(); // Role badge
    
    // Should NOT see admin tools
    await expect(page.getByText('Admin Tools')).not.toBeVisible();
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Check validation errors
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    
    // Try invalid email
    await page.getByLabel('Email address').fill('invalid-email');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Check validation errors
    await expect(page.getByText('Invalid email format')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill with invalid credentials
    await page.getByLabel('Email address').fill('invalid@healthcare.local');
    await page.getByLabel('Password').fill('invalidpassword');
    
    // Submit form
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should show error message
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    
    // Should still be on login page
    await expect(page).toHaveURL('/login');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.getByLabel('Email address').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
    
    // Should see success message (toast)
    await expect(page.getByText('Logged out successfully')).toBeVisible();
  });

  test('should maintain authentication state on page refresh', async ({ page }) => {
    // Login
    await page.getByLabel('Email address').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Refresh page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome, System Administrator')).toBeVisible();
  });

  test('should redirect authenticated users away from login page', async ({ page }) => {
    // Login
    await page.getByLabel('Email address').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Try to navigate to login page
    await page.goto('/login');
    
    // Should redirect back to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should protect admin routes from candidates', async ({ page }) => {
    // Login as candidate
    await page.getByLabel('Email address').fill(CANDIDATE_USER.email);
    await page.getByLabel('Password').fill(CANDIDATE_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Try to access admin route
    await page.goto('/admin');
    
    // Should see access denied page
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('Required role: admin')).toBeVisible();
    await expect(page.getByText('Your role: candidate')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/auth/login', route => {
      route.abort();
    });
    
    // Try to login
    await page.getByLabel('Email address').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should show network error message
    await expect(page.getByText('Network error. Please try again.')).toBeVisible();
  });
});

test.describe('Mobile Authentication', () => {
  test.use({ 
    viewport: { width: 375, height: 667 } // iPhone SE size
  });

  test('should work on mobile devices', async ({ page }) => {
    await page.goto('/');
    
    // Should still show login form on mobile
    await expect(page.getByText('Healthcare Portal')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    
    // Login should work
    await page.getByLabel('Email address').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome, System Administrator')).toBeVisible();
  });
});