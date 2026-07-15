'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;         // current value (0–5, supports decimals for display)
  onChange?: (v: number) => void;  // if provided, renders as interactive picker
  max?: number;          // default 5
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function StarRating({
  value,
  onChange,
  max = 5,
  size = 'md',
  className,
}: StarRatingProps) {
  const iconClass = sizeMap[size];
  const isInteractive = !!onChange;

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: max }).map((_, i) => {
        const starVal = i + 1;
        const filled = value >= starVal;
        const halfFilled = !filled && value >= starVal - 0.5;

        return (
          <button
            key={i}
            type="button"
            disabled={!isInteractive}
            onClick={() => onChange?.(starVal)}
            className={cn(
              'focus:outline-none transition-transform',
              isInteractive && 'hover:scale-110 cursor-pointer',
              !isInteractive && 'cursor-default'
            )}
            title={isInteractive ? `${starVal} out of ${max}` : undefined}
          >
            <Star
              className={cn(
                iconClass,
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : halfFilled
                  ? 'fill-amber-200 text-amber-400'
                  : 'fill-transparent text-muted-foreground/40'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Compact inline display: "★ 4.2 (12)" */
export function StarBadge({
  score,
  count,
  className,
}: {
  score: number;
  count?: number;
  className?: string;
}) {
  if (!score || score === 0) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>No ratings</span>
    );
  }
  return (
    <span className={cn('flex items-center gap-1 text-sm', className)}>
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-foreground">{score.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-muted-foreground text-xs">({count})</span>
      )}
    </span>
  );
}

/** Full 5-bar breakdown card row */
export function ScoreBar({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const pct = (score / 5) * 100;
  const color =
    score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium w-6 text-right">{score > 0 ? score.toFixed(1) : '—'}</span>
    </div>
  );
}
