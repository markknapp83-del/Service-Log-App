// Modern Toast notification system with enhanced animations and healthcare design
import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import { useToast } from '@/hooks/useToast';

const toastVariants = {
  success: {
    container: 'bg-healthcare-surface border-healthcare-success/20 shadow-healthcare-success/10',
    icon: 'bg-healthcare-success/10 text-healthcare-success',
    text: 'text-healthcare-text-primary',
    progress: 'bg-healthcare-success',
  },
  error: {
    container: 'bg-healthcare-surface border-destructive/20 shadow-destructive/10',
    icon: 'bg-destructive/10 text-destructive',
    text: 'text-healthcare-text-primary',
    progress: 'bg-destructive',
  },
  warning: {
    container: 'bg-healthcare-surface border-healthcare-warning/20 shadow-healthcare-warning/10',
    icon: 'bg-healthcare-warning/10 text-healthcare-warning',
    text: 'text-healthcare-text-primary',
    progress: 'bg-healthcare-warning',
  },
  info: {
    container: 'bg-healthcare-surface border-primary/20 shadow-primary/10',
    icon: 'bg-primary/10 text-primary',
    text: 'text-healthcare-text-primary',
    progress: 'bg-primary',
  },
};

const iconVariants = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

interface ToastItemProps {
  toast: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
  };
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const duration = toast.duration || 5000; // 5 seconds default
  const variant = toastVariants[toast.type];

  useEffect(() => {
    // Entrance animation
    const enterTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(progressInterval);
          handleDismiss();
          return 0;
        }
        return prev - (100 / (duration / 100));
      });
    }, 100);

    return () => {
      clearTimeout(enterTimeout);
      clearInterval(progressInterval);
    };
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200); // Wait for exit animation
  };

  const handleMouseEnter = () => {
    setProgress(100); // Reset progress on hover
  };

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border-2 shadow-xl backdrop-blur-sm transition-all duration-300 min-w-80 max-w-md',
        'transform-gpu', // Hardware acceleration
        variant.container,
        isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95',
        isExiting && 'translate-x-full opacity-0 scale-95'
      )}
      onMouseEnter={handleMouseEnter}
    >
      {/* Main Content */}
      <div className="flex items-start p-4 pb-2">
        {/* Icon */}
        <div className={cn(
          'flex items-center justify-center w-10 h-10 rounded-xl mr-3 flex-shrink-0',
          variant.icon
        )}>
          <span className="text-lg">{iconVariants[toast.type]}</span>
        </div>
        
        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-medium leading-relaxed', variant.text)}>
            {toast.message}
          </div>
        </div>
        
        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg ml-3 flex-shrink-0',
            'hover:bg-healthcare-text-muted/10 transition-colors duration-200',
            'text-healthcare-text-muted hover:text-healthcare-text-primary'
          )}
          aria-label="Dismiss notification"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none" 
            className="stroke-current stroke-2"
          >
            <path d="M12 4L4 12M4 4l8 8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="relative h-1 bg-healthcare-secondary/10">
        <div
          className={cn(
            'absolute top-0 left-0 h-full transition-all duration-100 ease-linear',
            variant.progress
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function Toast() {
  const { toasts, dismissToast } = useToast();

  return (
    <>
      {/* Toast Container */}
      <div 
        className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        <div className="flex flex-col gap-3 overflow-hidden">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </div>
      </div>

      {/* Toast Container for Mobile */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        <div className="flex flex-col gap-3">
          {toasts.map((toast) => (
            <div key={`mobile-${toast.id}`} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismissToast} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}