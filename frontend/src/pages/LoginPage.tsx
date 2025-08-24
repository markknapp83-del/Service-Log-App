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
import { Card } from '@/components/Card';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Healthcare Portal
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        <Card className="mt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
                error={errors.email?.message}
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
                {...register('password')}
              />
            </div>

            {errors.root && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">
                  {errors.root.message}
                </div>
              </div>
            )}

            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600">
              <p>Demo Accounts:</p>
              <p><strong>Admin:</strong> admin@healthcare.local / admin123</p>
              <p><strong>Candidate:</strong> candidate@healthcare.local / candidate123</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}