// Toast component following React 18 documentation patterns
import { useEffect } from 'react';
import { cn } from '@/utils/cn';
import { useToast } from '@/hooks/useToast';

const toastVariants = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconVariants = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function Toast() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center p-4 rounded-lg border shadow-lg min-w-80 animate-in slide-in-from-right duration-300',
            toastVariants[toast.type]
          )}
        >
          <div className="flex-shrink-0 text-lg mr-3">
            {iconVariants[toast.type]}
          </div>
          
          <div className="flex-1 text-sm font-medium">
            {toast.message}
          </div>
          
          <button
            onClick={() => dismissToast(toast.id)}
            className="flex-shrink-0 ml-4 text-lg hover:opacity-70 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}