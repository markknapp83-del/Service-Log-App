// Select component following shadcn/ui patterns for healthcare forms
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ 
    options, 
    value, 
    onValueChange, 
    placeholder = "Select an option", 
    disabled = false,
    error,
    className,
    ...props 
  }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const containerRef = React.useRef<HTMLDivElement>(null);
    
    const selectedOption = options.find(option => option.value === value);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (isOpen && highlightedIndex >= 0) {
            onValueChange(options[highlightedIndex].value);
            setIsOpen(false);
          } else {
            setIsOpen(!isOpen);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex(prev => 
              prev < options.length - 1 ? prev + 1 : prev
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        default:
          break;
      }
    };

    const handleOptionClick = (optionValue: string) => {
      onValueChange(optionValue);
      setIsOpen(false);
    };

    // Close dropdown when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div ref={containerRef} className="relative">
        <button
          ref={ref}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm shadow-sm placeholder:text-neutral-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          {...props}
        >
          <span className={cn(
            selectedOption ? "text-neutral-900" : "text-neutral-400"
          )}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-neutral-400 transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
            <div 
              role="listbox"
              className="max-h-60 overflow-auto rounded-lg py-1"
            >
              {options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionClick(option.value)}
                  disabled={option.disabled}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    value === option.value && "bg-blue-50 text-blue-600 font-medium",
                    highlightedIndex === index && "bg-neutral-100"
                  )}
                  role="option"
                  aria-selected={value === option.value}
                >
                  {option.label}
                </button>
              ))}
              {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-neutral-500">
                  No options available
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';