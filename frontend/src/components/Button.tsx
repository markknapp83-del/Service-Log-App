// Modern Button component with enhanced animations and states
import { forwardRef, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background relative overflow-hidden group',
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-primary-foreground shadow-md',
          'hover:bg-primary/90 hover:shadow-lg hover:scale-[1.02]',
          'active:scale-[0.98] active:shadow-sm',
          'disabled:hover:scale-100 disabled:hover:shadow-md',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground shadow-sm border border-border',
          'hover:bg-secondary/80 hover:shadow-md hover:scale-[1.01]',
          'active:scale-[0.99] active:shadow-sm',
          'disabled:hover:scale-100 disabled:hover:shadow-sm',
        ],
        outline: [
          'border-2 border-border bg-transparent text-foreground shadow-sm',
          'hover:bg-accent hover:text-accent-foreground hover:border-primary/30 hover:shadow-md hover:scale-[1.01]',
          'active:scale-[0.99] active:shadow-sm',
          'disabled:hover:scale-100 disabled:hover:shadow-sm disabled:hover:border-border',
        ],
        ghost: [
          'bg-transparent text-foreground',
          'hover:bg-accent hover:text-accent-foreground hover:scale-[1.02]',
          'active:scale-[0.98]',
          'disabled:hover:scale-100',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground shadow-md',
          'hover:bg-destructive/90 hover:shadow-lg hover:scale-[1.02]',
          'active:scale-[0.98] active:shadow-sm',
          'disabled:hover:scale-100 disabled:hover:shadow-md',
        ],
        success: [
          'bg-healthcare-success text-white shadow-md',
          'hover:bg-healthcare-success/90 hover:shadow-lg hover:scale-[1.02]',
          'active:scale-[0.98] active:shadow-sm',
          'disabled:hover:scale-100 disabled:hover:shadow-md',
        ],
        warning: [
          'bg-healthcare-warning text-white shadow-md',
          'hover:bg-healthcare-warning/90 hover:shadow-lg hover:scale-[1.02]',
          'active:scale-[0.98] active:shadow-sm',
          'disabled:hover:scale-100 disabled:hover:shadow-md',
        ],
        gradient: [
          'bg-gradient-to-r from-primary to-healthcare-accent text-white shadow-lg',
          'hover:shadow-xl hover:scale-[1.02]',
          'active:scale-[0.98] active:shadow-md',
          'disabled:hover:scale-100 disabled:hover:shadow-lg',
        ],
      },
      size: {
        xs: 'h-7 px-2 text-xs rounded-lg',
        sm: 'h-8 px-3 text-sm rounded-lg',
        md: 'h-10 px-4 text-sm rounded-xl',
        lg: 'h-12 px-6 text-base rounded-xl',
        xl: 'h-14 px-8 text-lg rounded-2xl',
        icon: 'h-10 w-10 rounded-xl',
        'icon-sm': 'h-8 w-8 rounded-lg',
        'icon-lg': 'h-12 w-12 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ripple?: boolean;
  asChild?: boolean;
}

// Ripple effect component
const RippleEffect = ({ ripple }: { ripple: boolean }) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const addRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ripple) return;
    
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now();

    setRipples(prev => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  return (
    <div 
      className="absolute inset-0 overflow-hidden rounded-inherit pointer-events-none"
      onMouseDown={addRipple}
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
          }}
        />
      ))}
    </div>
  );
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    isLoading, 
    loadingText, 
    leftIcon, 
    rightIcon, 
    ripple = true, 
    children, 
    disabled, 
    ...props 
  }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Ripple Effect */}
        <RippleEffect ripple={ripple && !disabled && !isLoading} />
        
        {/* Loading State */}
        {isLoading && (
          <div className="mr-2 flex items-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {loadingText && <span className="ml-2">{loadingText}</span>}
          </div>
        )}
        
        {/* Left Icon */}
        {!isLoading && leftIcon && (
          <span className="mr-2 flex items-center transition-transform group-hover:scale-110">
            {leftIcon}
          </span>
        )}
        
        {/* Button Content */}
        {!loadingText && children}
        
        {/* Right Icon */}
        {!isLoading && rightIcon && (
          <span className="ml-2 flex items-center transition-transform group-hover:scale-110">
            {rightIcon}
          </span>
        )}
        
        {/* Hover effect overlay */}
        <div className="absolute inset-0 bg-white/5 opacity-0 transition-opacity group-hover:opacity-100 rounded-inherit" />
      </button>
    );
  }
);
Button.displayName = 'Button';

// Specialized button variants for healthcare use cases

const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = 'icon', ...props }, ref) => {
    return (
      <Button ref={ref} size={size} {...props}>
        {children}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';

const ActionButton = forwardRef<HTMLButtonElement, ButtonProps & {
  actionType?: 'save' | 'delete' | 'edit' | 'view' | 'download' | 'upload';
}>(({ actionType, children, variant, leftIcon, ...props }, ref) => {
  const actionIcons = {
    save: '💾',
    delete: '🗑️',
    edit: '✏️',
    view: '👁️',
    download: '⬇️',
    upload: '⬆️',
  };

  const actionVariants = {
    save: 'success' as const,
    delete: 'destructive' as const,
    edit: 'outline' as const,
    view: 'ghost' as const,
    download: 'secondary' as const,
    upload: 'primary' as const,
  };

  return (
    <Button
      ref={ref}
      variant={variant || (actionType && actionVariants[actionType]) || 'primary'}
      leftIcon={leftIcon || (actionType && actionIcons[actionType])}
      {...props}
    >
      {children}
    </Button>
  );
});
ActionButton.displayName = 'ActionButton';

const FloatingActionButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = 'icon-lg', variant = 'primary', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          'fixed bottom-6 right-6 z-50 shadow-2xl hover:shadow-2xl rounded-full',
          'transform hover:scale-110 active:scale-95 transition-all duration-300',
          className
        )}
        size={size}
        variant={variant}
        {...props}
      />
    );
  }
);
FloatingActionButton.displayName = 'FloatingActionButton';

export { 
  Button, 
  IconButton, 
  ActionButton, 
  FloatingActionButton, 
  buttonVariants,
  type ButtonProps 
};