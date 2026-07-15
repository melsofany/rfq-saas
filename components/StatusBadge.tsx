'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusVariant = 'gray' | 'blue' | 'amber' | 'green' | 'slate' | 'red' | 'purple';

const variantClasses: Record<StatusVariant, string> = {
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  slate: 'bg-slate-200 text-slate-700 border-slate-300',
  red: 'bg-red-100 text-red-700 border-red-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
};

const statusMap: Record<string, { variant: StatusVariant; label: string }> = {
  // RFQ workflow statuses (uppercase canonical values)
  draft:   { variant: 'gray',  label: 'Draft' },
  sent:    { variant: 'blue',  label: 'Sent' },
  quoted:  { variant: 'amber', label: 'Quoted' },
  failed:  { variant: 'red',   label: 'Failed' },
  success: { variant: 'green', label: 'Success' },
  // Legacy / other statuses kept for backward compat
  partial:   { variant: 'amber',  label: 'Partial' },
  completed: { variant: 'green',  label: 'Completed' },
  closed:    { variant: 'slate',  label: 'Closed' },
  open:      { variant: 'blue',   label: 'Open' },
  pending:   { variant: 'amber',  label: 'Pending' },
  approved:  { variant: 'green',  label: 'Approved' },
  rejected:  { variant: 'red',    label: 'Rejected' },
  cancelled: { variant: 'slate',  label: 'Cancelled' },
  active:    { variant: 'green',  label: 'Active' },
  inactive:  { variant: 'gray',   label: 'Inactive' },
  received:  { variant: 'purple', label: 'Received' },
  submitted: { variant: 'blue',   label: 'Submitted' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusMap[status?.toLowerCase()] ?? { variant: 'gray' as StatusVariant, label: status || 'Unknown' };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium capitalize',
        variantClasses[config.variant],
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
