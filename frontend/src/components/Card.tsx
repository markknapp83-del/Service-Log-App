// Modern Card component with enhanced styling and interaction states
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

// Card variant configuration for different use cases
const cardVariants = cva(
  'border bg-card text-card-foreground transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'rounded-2xl shadow-md hover:shadow-lg',
        elevated: 'rounded-2xl shadow-lg hover:shadow-xl',
        interactive: 'rounded-2xl shadow-md hover:shadow-lg hover:border-primary/20 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]',
        outlined: 'rounded-2xl border-2 shadow-sm hover:shadow-md',
        glass: 'rounded-2xl backdrop-blur-sm bg-card/80 shadow-lg border border-white/20',
        flat: 'rounded-xl border-0 shadow-none bg-muted/50',
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface CardProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-2 p-6 pb-4',
        className
      )}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-display text-xl font-semibold leading-tight tracking-tight text-healthcare-text-primary',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        'text-sm text-healthcare-text-secondary leading-relaxed',
        className
      )}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn('px-6 pb-6', className)} 
      {...props} 
    />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between px-6 pb-6 pt-0 gap-4',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

// New specialized card components for healthcare use cases

const StatusCard = forwardRef<HTMLDivElement, CardProps & {
  status?: 'active' | 'inactive' | 'warning' | 'error';
  statusLabel?: string;
}>(({ className, status = 'active', statusLabel, children, ...props }, ref) => {
  const statusColors = {
    active: 'border-l-healthcare-success',
    inactive: 'border-l-healthcare-secondary-300',
    warning: 'border-l-healthcare-warning',
    error: 'border-l-healthcare-error',
  };

  return (
    <Card
      ref={ref}
      className={cn(
        'border-l-4',
        statusColors[status],
        className
      )}
      {...props}
    >
      {statusLabel && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              status === 'active' && 'bg-healthcare-success',
              status === 'inactive' && 'bg-healthcare-secondary-300',
              status === 'warning' && 'bg-healthcare-warning',
              status === 'error' && 'bg-healthcare-error',
            )} />
            <span className="text-xs font-medium text-healthcare-text-muted uppercase tracking-wider">
              {statusLabel}
            </span>
          </div>
        </div>
      )}
      {children}
    </Card>
  );
});
StatusCard.displayName = 'StatusCard';

const MetricCard = forwardRef<HTMLDivElement, CardProps & {
  metric: string | number;
  metricLabel: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}>(({ className, metric, metricLabel, trend, trendValue, children, ...props }, ref) => {
  const trendColors = {
    up: 'text-healthcare-success',
    down: 'text-healthcare-error',
    neutral: 'text-healthcare-text-muted',
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→',
  };

  return (
    <Card
      ref={ref}
      className={cn('hover:shadow-lg transition-shadow', className)}
      {...props}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-healthcare-text-secondary">
              {metricLabel}
            </p>
            <p className="text-3xl font-bold font-display text-healthcare-text-primary mt-2">
              {metric}
            </p>
          </div>
          {trend && trendValue && (
            <div className={cn('flex items-center text-sm font-medium', trendColors[trend])}>
              <span className="mr-1">{trendIcons[trend]}</span>
              {trendValue}
            </div>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
});
MetricCard.displayName = 'MetricCard';

const ActionCard = forwardRef<HTMLDivElement, CardProps & {
  icon?: React.ReactNode;
  actionLabel?: string;
}>(({ className, icon, actionLabel, children, ...props }, ref) => {
  return (
    <Card
      ref={ref}
      variant="interactive"
      className={cn('group', className)}
      {...props}
    >
      <CardContent className="pt-6">
        {icon && (
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
            {icon}
          </div>
        )}
        <div className="space-y-2">
          {actionLabel && (
            <h3 className="font-semibold text-healthcare-text-primary group-hover:text-primary transition-colors">
              {actionLabel}
            </h3>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  );
});
ActionCard.displayName = 'ActionCard';

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  StatusCard,
  MetricCard,
  ActionCard,
  cardVariants,
};