import React from 'react';
import { ProjectPhaseState } from '@/utils/phaseUtils';
import { cn } from '@/lib/utils';

/** "Phase 2 of 4 - 3/7 done", glowing when 1-2 tasks remain. */
export const PhaseProgressBadge: React.FC<{ state?: ProjectPhaseState; className?: string }> = ({ state, className }) => {
  if (!state || state.activePhase == null) return null;
  const left = state.activeTotal - state.activeDone;
  const almost = left > 0 && left <= 2;
  const idx = state.phases.indexOf(state.activePhase) + 1;
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <span className={cn(
        'text-xs rounded-full border px-3 py-1 bg-background/60',
        almost ? 'border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)] animate-pulse' : 'border-border text-muted-foreground'
      )}>
        Phase {idx} of {state.phases.length} · {state.activeDone}/{state.activeTotal} done{almost ? ' · almost there!' : ''}
      </span>
      <div className="h-1 w-40 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all duration-700"
          style={{ width: `${state.activeTotal ? (state.activeDone / state.activeTotal) * 100 : 0}%` }} />
      </div>
    </div>
  );
};
