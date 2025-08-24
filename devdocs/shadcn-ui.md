# shadcn/ui Documentation for Healthcare Service Log Portal

## Overview
shadcn/ui is a modern component library that provides beautiful, accessible, and customizable React components built with Radix UI primitives and styled with Tailwind CSS.

## Installation and Setup

### Initial Setup
```bash
npx shadcn-ui@latest init
```

### Configuration
```javascript
// components.json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### Install Specific Components
```bash
# Essential components for healthcare portal
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add form
npx shadcn-ui@latest add select
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add pagination
```

## Core Components for Healthcare Application

### Button Component
```typescript
// components/ui/Button.tsx - Extended for healthcare use cases
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // Healthcare-specific variants
        success: 'bg-green-600 text-white hover:bg-green-700',
        warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
        medical: 'bg-blue-600 text-white hover:bg-blue-700'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading...
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

### Patient Information Card
```typescript
// components/PatientCard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Calendar, User } from 'lucide-react';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email?: string;
  status: 'active' | 'inactive' | 'pending';
  lastVisit?: string;
}

interface PatientCardProps {
  patient: Patient;
  onSelect?: (patientId: string) => void;
  onEdit?: (patientId: string) => void;
  className?: string;
}

export function PatientCard({ patient, onSelect, onEdit, className }: PatientCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <Card className={`hover:shadow-md transition-shadow cursor-pointer ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarFallback className="bg-blue-100 text-blue-700">
                {getInitials(patient.firstName, patient.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                ID: {patient.id.slice(-8)}
              </CardDescription>
            </div>
          </div>
          <Badge className={getStatusColor(patient.status)}>
            {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>DOB: {formatDate(patient.dateOfBirth)}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{patient.phone}</span>
          </div>
          
          {patient.email && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{patient.email}</span>
            </div>
          )}
          
          {patient.lastVisit && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Last visit: {formatDate(patient.lastVisit)}</span>
            </div>
          )}
        </div>
        
        <div className="flex space-x-2 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onSelect?.(patient.id)}
          >
            View Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit?.(patient.id)}
          >
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Service Entry Form
```typescript
// components/ServiceEntryForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const serviceSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  serviceType: z.enum(['consultation', 'procedure', 'therapy', 'diagnostic']),
  providerId: z.string().uuid('Invalid provider ID'),
  scheduledDate: z.date({
    required_error: 'Scheduled date is required',
  }),
  duration: z.number().min(15).max(480),
  notes: z.string().max(1000).optional(),
  billingCode: z.string().optional(),
  billingAmount: z.number().positive().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceEntryFormProps {
  patientId?: string;
  onSubmit: (data: ServiceFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const serviceTypes = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'therapy', label: 'Therapy' },
  { value: 'diagnostic', label: 'Diagnostic' },
];

export function ServiceEntryForm({ 
  patientId, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: ServiceEntryFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      patientId: patientId || '',
      duration: 60,
      scheduledDate: new Date(),
    },
  });

  const handleSubmit = async (data: ServiceFormData) => {
    try {
      setSubmitError(null);
      await onSubmit(data);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'An error occurred while saving the service entry'
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="serviceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {serviceTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={15}
                    max={480}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Duration in minutes (15-480)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="scheduledDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Scheduled Date & Time</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about the service..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional notes (max 1000 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="billingCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., CPT-99213" {...field} />
                </FormControl>
                <FormDescription>Optional billing/procedure code</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="billingAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Optional billing amount</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isLoading}
            variant="medical"
          >
            Save Service Entry
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### Data Table Component
```typescript
// components/DataTable.tsx
import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Status Badge Component
```typescript
// components/StatusBadge.tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ServiceStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
type PatientStatus = 'active' | 'inactive' | 'pending';

interface StatusBadgeProps {
  status: ServiceStatus | PatientStatus;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Service statuses
  scheduled: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  completed: 'bg-green-100 text-green-800 hover:bg-green-200',
  cancelled: 'bg-red-100 text-red-800 hover:bg-red-200',
  
  // Patient statuses  
  active: 'bg-green-100 text-green-800 hover:bg-green-200',
  inactive: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const displayText = status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  return (
    <Badge 
      className={cn(
        statusStyles[status] || 'bg-gray-100 text-gray-800',
        className
      )}
      variant="secondary"
    >
      {displayText}
    </Badge>
  );
}
```

### Alert and Notification System
```typescript
// components/NotificationSystem.tsx
import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Toast } from '@/components/ui/toast';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  type: NotificationType;
  title: string;
  description?: string;
  duration?: number;
}

const notificationIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const notificationStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

export function useNotification() {
  const { toast } = useToast();

  const notify = ({ type, title, description, duration = 5000 }: NotificationProps) => {
    const Icon = notificationIcons[type];
    
    toast({
      title: (
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </div>
      ),
      description,
      duration,
      className: notificationStyles[type],
    });
  };

  return {
    success: (title: string, description?: string) => 
      notify({ type: 'success', title, description }),
    error: (title: string, description?: string) => 
      notify({ type: 'error', title, description }),
    warning: (title: string, description?: string) => 
      notify({ type: 'warning', title, description }),
    info: (title: string, description?: string) => 
      notify({ type: 'info', title, description }),
  };
}

// Example usage in a component
export function PatientActions() {
  const notification = useNotification();

  const handlePatientSave = async () => {
    try {
      // Save patient logic
      notification.success('Patient saved', 'Patient information has been updated successfully.');
    } catch (error) {
      notification.error('Save failed', 'Unable to save patient information. Please try again.');
    }
  };

  return (
    <button onClick={handlePatientSave}>
      Save Patient
    </button>
  );
}
```

### Dashboard Layout Component
```typescript
// components/DashboardLayout.tsx
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Menu, 
  Users, 
  Calendar, 
  FileText, 
  Settings, 
  LogOut,
  Home,
  Activity
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  onLogout: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Services', href: '/services', icon: Activity },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function DashboardLayout({ children, user, onLogout }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 lg:hidden"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="lg:hidden">
                {/* Mobile menu button space */}
              </div>
              
              <div className="ml-auto flex items-center space-x-4">
                {user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user.name}</p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground capitalize">
                            {user.role}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1">
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">
          Healthcare Portal
        </h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          >
            <item.icon
              className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
              aria-hidden="true"
            />
            {item.name}
          </a>
        ))}
      </nav>
    </div>
  );
}
```

## Theming and Customization

### Custom Theme Configuration
```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Healthcare color palette */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 72.22% 50.59%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;

    /* Healthcare-specific colors */
    --medical-primary: 210 100% 50%;
    --medical-success: 142 71% 45%;
    --medical-warning: 38 92% 50%;
    --medical-error: 0 72% 51%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark theme variables */
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  .healthcare-gradient {
    @apply bg-gradient-to-r from-blue-600 to-blue-800;
  }
  
  .medical-card {
    @apply bg-white rounded-lg shadow-sm border border-gray-200 p-6;
  }
  
  .status-indicator {
    @apply w-2 h-2 rounded-full;
  }
  
  .status-indicator.active {
    @apply bg-green-500;
  }
  
  .status-indicator.inactive {
    @apply bg-gray-400;
  }
  
  .status-indicator.pending {
    @apply bg-yellow-500;
  }
}
```

## Accessibility Features

### ARIA Labels and Screen Reader Support
```typescript
// components/AccessibleComponents.tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AccessibleForm() {
  return (
    <form className="space-y-4">
      <div>
        <Label htmlFor="patient-name" className="sr-only">
          Patient Name
        </Label>
        <Input
          id="patient-name"
          name="patientName"
          placeholder="Enter patient name"
          aria-describedby="patient-name-help"
          aria-required="true"
        />
        <div id="patient-name-help" className="text-sm text-muted-foreground mt-1">
          Enter the patient's full name
        </div>
      </div>

      <Button
        type="submit"
        aria-label="Save patient information"
        className="w-full"
      >
        Save Patient
      </Button>
    </form>
  );
}

// Loading states with proper announcements
export function LoadingButton({ isLoading, children, ...props }) {
  return (
    <Button {...props} disabled={isLoading} aria-busy={isLoading}>
      {isLoading && (
        <span className="sr-only">Loading, please wait...</span>
      )}
      {children}
    </Button>
  );
}

// Status announcements for screen readers
export function StatusAnnouncement({ status, children }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {status}
    </div>
  );
}
```

## Performance Optimization

### Lazy Loading Components
```typescript
// components/LazyComponents.ts
import { lazy } from 'react';

// Lazy load heavy components
export const PatientChart = lazy(() => import('./PatientChart'));
export const ReportsModule = lazy(() => import('./ReportsModule'));
export const AdvancedSearch = lazy(() => import('./AdvancedSearch'));

// Usage with Suspense
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsModule />
      </Suspense>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
```

## Testing Components

### Component Testing with React Testing Library
```typescript
// components/__tests__/PatientCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientCard } from '../PatientCard';

const mockPatient = {
  id: 'patient-123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1985-01-15',
  phone: '555-123-4567',
  email: 'john@example.com',
  status: 'active' as const,
  lastVisit: '2023-12-01',
};

describe('PatientCard', () => {
  test('renders patient information correctly', () => {
    render(<PatientCard patient={mockPatient} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('calls onSelect when View Details is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = jest.fn();
    
    render(<PatientCard patient={mockPatient} onSelect={mockOnSelect} />);

    const viewButton = screen.getByText('View Details');
    await user.click(viewButton);

    expect(mockOnSelect).toHaveBeenCalledWith('patient-123');
  });

  test('displays correct status badge color', () => {
    render(<PatientCard patient={{ ...mockPatient, status: 'inactive' }} />);

    const badge = screen.getByText('Inactive');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });
});
```

## Best Practices

### 1. Component Organization
- Keep components small and focused
- Use composition over inheritance
- Implement proper TypeScript interfaces
- Follow naming conventions

### 2. Accessibility
- Always provide ARIA labels
- Use semantic HTML elements
- Test with screen readers
- Ensure keyboard navigation works

### 3. Performance
- Use React.memo for expensive components
- Implement proper loading states
- Lazy load non-critical components
- Optimize bundle size

### 4. Testing
- Test user interactions, not implementation
- Use proper test data factories
- Mock external dependencies
- Test accessibility features

### 5. Healthcare-Specific Considerations
- Ensure HIPAA compliance in component design
- Use proper medical terminology
- Implement audit trails for data changes
- Consider offline functionality

## Resources
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [Radix UI Primitives](https://www.radix-ui.com/docs/primitives/overview/introduction)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)