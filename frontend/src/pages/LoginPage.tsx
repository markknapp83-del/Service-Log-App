// Login page following React Hook Form + Zod documentation patterns
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { LoginFormData } from '@/types';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card, CardContent } from '@/components/Card';
import { useToast } from '@/hooks/useToast';

// Validation schema following Zod documentation patterns
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await login(data);

      if (!response.success) {
        // Handle authentication errors
        if (response.error.code === 'AUTHENTICATION_ERROR') {
          setError('root', { 
            message: 'Invalid email or password' 
          });
        } else if (response.error.code === 'VALIDATION_ERROR') {
          // Handle field-specific validation errors
          const details = response.error.details as { errors?: Array<{ field: string; message: string }> };
          if (details?.errors) {
            details.errors.forEach(({ field, message }) => {
              setError(field as keyof LoginFormData, { message });
            });
          }
        } else {
          showToast({
            type: 'error',
            message: response.error.message || 'Login failed',
          });
        }
      } else {
        showToast({
          type: 'success',
          message: 'Login successful',
        });
      }
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Network error. Please try again.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-healthcare-background via-healthcare-surface to-healthcare-primary/5 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-primary/5 animate-pulse"></div>
          <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-healthcare-accent/5 animate-pulse animation-delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-healthcare-secondary/5 animate-pulse animation-delay-500"></div>
        </div>

        {/* Header Section */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-healthcare-accent flex items-center justify-center shadow-lg">
              <span className="text-2xl text-white">🏥</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-healthcare-text-primary font-display mb-3">
            Healthcare Portal
          </h1>
          <p className="text-lg text-healthcare-text-secondary">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        {/* Login Form Card */}
        <Card variant="elevated" className="animate-slide-up backdrop-blur-sm border-white/20">
          <CardContent className="pt-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Enter your email address"
                  error={errors.email?.message}
                  leftIcon={<span className="text-lg">📧</span>}
                  floatingLabel={false}
                  {...register('email')}
                />
              </div>

              <div>
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  error={errors.password?.message}
                  leftIcon={<span className="text-lg">🔒</span>}
                  floatingLabel={false}
                  {...register('password')}
                />
              </div>

              {/* Error Display */}
              {errors.root && (
                <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 animate-slide-down">
                  <div className="flex items-center gap-2">
                    <span className="text-destructive text-lg">⚠️</span>
                    <div className="text-sm text-destructive font-medium">
                      {errors.root.message}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  isLoading={isSubmitting}
                  loadingText="Signing in"
                  className="w-full"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Demo Accounts Section */}
        <Card variant="glass" className="mt-8 animate-slide-up animation-delay-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-lg">🚀</span>
                <h3 className="text-sm font-semibold text-healthcare-text-primary uppercase tracking-wider">
                  Demo Accounts
                </h3>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-primary">👑</span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-healthcare-text-primary text-sm">Administrator</p>
                      <p className="text-xs text-healthcare-text-muted">
                        admin@healthcare.local • admin123
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-healthcare-accent/5 rounded-xl p-4 border border-healthcare-accent/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-healthcare-accent/10 flex items-center justify-center">
                      <span className="text-healthcare-accent">📋</span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-healthcare-text-primary text-sm">Service Provider</p>
                      <p className="text-xs text-healthcare-text-muted">
                        candidate@healthcare.local • candidate123
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-healthcare-text-muted flex items-center justify-center gap-1">
                  <span>🔐</span>
                  Secure healthcare data management platform
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center animate-fade-in animation-delay-300">
          <p className="text-xs text-healthcare-text-muted">
            Healthcare Portal v7.0 • Secure • HIPAA Compliant
          </p>
        </div>
      </div>
    </div>
  );
}