// Modern Input component with enhanced visual states and healthcare focus
import { forwardRef, useState, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const inputVariants = cva(
  'flex w-full border bg-background text-sm transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: [
          'border-input rounded-xl px-4 py-3 shadow-sm',
          'placeholder:text-muted-foreground',
          'focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:shadow-md',
          'hover:border-primary/30',
        ],
        outlined: [
          'border-2 border-border rounded-xl px-4 py-3',
          'placeholder:text-muted-foreground',
          'focus:border-primary focus:shadow-md hover:border-primary/30',
        ],
        filled: [
          'border-0 bg-muted rounded-xl px-4 py-3',
          'placeholder:text-muted-foreground',
          'focus:bg-background focus:ring-2 focus:ring-primary/20 focus:shadow-md',
          'hover:bg-background/80',
        ],
        ghost: [
          'border-0 bg-transparent rounded-lg px-3 py-2',
          'placeholder:text-muted-foreground',
          'focus:bg-accent focus:shadow-sm hover:bg-accent/50',
        ],
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-lg',
        md: 'h-11 px-4 text-sm rounded-xl',
        lg: 'h-12 px-5 text-base rounded-xl',
        xl: 'h-14 px-6 text-lg rounded-2xl',
      },
      state: {
        default: '',
        error: 'border-destructive focus:border-destructive focus:ring-destructive/20 shadow-destructive/10',
        success: 'border-healthcare-success focus:border-healthcare-success focus:ring-healthcare-success/20 shadow-healthcare-success/10',
        warning: 'border-healthcare-warning focus:border-healthcare-warning focus:ring-healthcare-warning/20 shadow-healthcare-warning/10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      state: 'default',
    },
  }
);

export interface InputProps 
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  floatingLabel?: boolean;
  showCharCount?: boolean;
  maxCharCount?: number;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type, 
    label, 
    error, 
    helperText, 
    leftIcon, 
    rightIcon, 
    floatingLabel = false,
    showCharCount = false,
    maxCharCount,
    variant,
    size,
    state,
    value,
    onChange,
    id,
    placeholder,
    ...props 
  }, ref) => {
    const [focused, setFocused] = useState(false);
    const [internalValue, setInternalValue] = useState(value || '');
    
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasValue = Boolean(internalValue || value);
    const isFloating = floatingLabel && (focused || hasValue);
    
    // Determine input state based on props
    const currentState = error ? 'error' : state || 'default';
    
    const handleFocus = useCallback(() => {
      setFocused(true);
    }, []);
    
    const handleBlur = useCallback(() => {
      setFocused(false);
    }, []);
    
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
    }, [onChange]);

    const charCount = typeof (value || internalValue) === 'string' 
      ? (value || internalValue).length 
      : 0;

    return (
      <div className="space-y-2">
        {/* Standard Label (non-floating) */}
        {label && !floatingLabel && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-healthcare-text-primary"
          >
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Floating Label */}
          {label && floatingLabel && (
            <label
              htmlFor={inputId}
              className={cn(
                'absolute left-4 transition-all duration-200 pointer-events-none select-none',
                'text-healthcare-text-secondary',
                isFloating
                  ? 'top-2 text-xs font-medium text-primary'
                  : 'top-1/2 transform -translate-y-1/2 text-sm',
                leftIcon && 'left-10'
              )}
            >
              {label}
              {props.required && <span className="text-destructive ml-1">*</span>}
            </label>
          )}

          {/* Input Field */}
          <input
            type={type}
            className={cn(
              inputVariants({ variant, size, state: currentState }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              floatingLabel && isFloating && 'pt-6 pb-2',
              focused && 'ring-2',
              className
            )}
            ref={ref}
            id={inputId}
            value={value}
            placeholder={floatingLabel ? '' : placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />

          {/* Right Icon */}
          {rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}

          {/* Focus Border Animation */}
          <div 
            className={cn(
              'absolute inset-0 border-2 border-primary rounded-xl opacity-0 transition-opacity duration-200 pointer-events-none',
              focused && 'opacity-20'
            )}
          />
        </div>

        {/* Helper Text and Character Count */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {/* Error Message */}
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1" role="alert">
                <span className="text-base">⚠</span>
                {error}
              </p>
            )}
            
            {/* Helper Text */}
            {helperText && !error && (
              <p className="text-sm text-healthcare-text-muted flex items-center gap-1">
                <span className="text-xs">💡</span>
                {helperText}
              </p>
            )}
          </div>

          {/* Character Count */}
          {showCharCount && maxCharCount && (
            <p className={cn(
              'text-xs font-medium tabular-nums',
              charCount > maxCharCount 
                ? 'text-destructive' 
                : charCount > maxCharCount * 0.8 
                  ? 'text-healthcare-warning' 
                  : 'text-healthcare-text-muted'
            )}>
              {charCount}/{maxCharCount}
            </p>
          )}
        </div>
      </div>
    );
  }
);
Input.displayName = 'Input';

// Specialized Input Variants for Healthcare Use Cases

const SearchInput = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, placeholder = "Search...", ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        leftIcon={leftIcon || <span className="text-lg">🔍</span>}
        placeholder={placeholder}
        variant="filled"
        {...props}
      />
    );
  }
);
SearchInput.displayName = 'SearchInput';

const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ rightIcon, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    
    return (
      <Input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-healthcare-text-muted hover:text-healthcare-text-primary transition-colors p-1 rounded-md hover:bg-accent"
            tabIndex={-1}
          >
            {showPassword ? '👁️' : '🙈'}
          </button>
        }
        {...props}
      />
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

const NumberInput = forwardRef<HTMLInputElement, InputProps & {
  min?: number;
  max?: number;
  step?: number;
  showSpinner?: boolean;
}>(({ min, max, step = 1, showSpinner = true, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      type="number"
      min={min}
      max={max}
      step={step}
      className={cn(
        !showSpinner && '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
      )}
      {...props}
    />
  );
});
NumberInput.displayName = 'NumberInput';

const TextArea = forwardRef<HTMLTextAreaElement, Omit<InputProps, 'type'> & {
  rows?: number;
  resize?: boolean;
}>(({ 
  className, 
  label, 
  error, 
  helperText, 
  showCharCount, 
  maxCharCount,
  floatingLabel = false,
  rows = 4,
  resize = true,
  value,
  onChange,
  id,
  ...props 
}, ref) => {
  const [focused, setFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(value || '');
  
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const hasValue = Boolean(internalValue || value);
  const isFloating = floatingLabel && (focused || hasValue);
  
  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);
  
  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalValue(e.target.value);
    onChange?.(e);
  }, [onChange]);

  const charCount = typeof (value || internalValue) === 'string' 
    ? (value || internalValue).length 
    : 0;

  return (
    <div className="space-y-2">
      {/* Standard Label (non-floating) */}
      {label && !floatingLabel && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-healthcare-text-primary"
        >
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {/* TextArea Container */}
      <div className="relative">
        {/* Floating Label */}
        {label && floatingLabel && (
          <label
            htmlFor={textareaId}
            className={cn(
              'absolute left-4 transition-all duration-200 pointer-events-none select-none z-10',
              'text-healthcare-text-secondary',
              isFloating
                ? 'top-2 text-xs font-medium text-primary'
                : 'top-4 text-sm'
            )}
          >
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}

        {/* TextArea Field */}
        <textarea
          className={cn(
            'flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm transition-all duration-200',
            'placeholder:text-muted-foreground',
            'focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:shadow-md focus-visible:outline-none',
            'hover:border-primary/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            !resize && 'resize-none',
            floatingLabel && isFloating && 'pt-6 pb-3',
            className
          )}
          ref={ref}
          id={textareaId}
          rows={rows}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          {...props}
        />

        {/* Focus Border Animation */}
        <div 
          className={cn(
            'absolute inset-0 border-2 border-primary rounded-xl opacity-0 transition-opacity duration-200 pointer-events-none',
            focused && 'opacity-20'
          )}
        />
      </div>

      {/* Helper Text and Character Count */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1" role="alert">
              <span className="text-base">⚠</span>
              {error}
            </p>
          )}
          
          {/* Helper Text */}
          {helperText && !error && (
            <p className="text-sm text-healthcare-text-muted flex items-center gap-1">
              <span className="text-xs">💡</span>
              {helperText}
            </p>
          )}
        </div>

        {/* Character Count */}
        {showCharCount && maxCharCount && (
          <p className={cn(
            'text-xs font-medium tabular-nums',
            charCount > maxCharCount 
              ? 'text-destructive' 
              : charCount > maxCharCount * 0.8 
                ? 'text-healthcare-warning' 
                : 'text-healthcare-text-muted'
          )}>
            {charCount}/{maxCharCount}
          </p>
        )}
      </div>
    </div>
  );
});
TextArea.displayName = 'TextArea';

export { 
  Input, 
  SearchInput, 
  PasswordInput, 
  NumberInput, 
  TextArea,
  inputVariants,
  type InputProps 
};