import React, { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PHASE_CELEBRATE_EVENT, PhaseCelebrationDetail } from '@/hooks/usePhaseGate';
import { playLevelUpChime } from '@/utils/phaseUtils';

/** Small celebration banner shown when a project phase is finished. */
export const PhaseCelebration: React.FC = () => {
  const [items, setItems] = useState<PhaseCelebrationDetail[]>([]);

  useEffect(() => {
    const onDone = (e: Event) => {
      const d = (e as CustomEvent<PhaseCelebrationDetail>).detail;
      setItems(prev => [...prev, d]);
      playLevelUpChime(); // silent when the timer is muted
    };
    window.addEventListener(PHASE_CELEBRATE_EVENT, onDone);
    return () => window.removeEventListener(PHASE_CELEBRATE_EVENT, onDone);
  }, []);

  if (!items.length) return null;
  const c = items[0];
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)] animate-slideIn">
      <div className="rounded-xl border border-primary/40 bg-card text-card-foreground shadow-2xl p-4 flex gap-3 items-start">
        <div className="rounded-full bg-primary/15 p-2 animate-bounce"><Trophy className="h-5 w-5 text-primary" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Phase {c.phase} cleared!</p>
          <p className="text-sm text-muted-foreground truncate">{c.projectName}</p>
          {c.reward && <p className="text-sm mt-1">Reward: <span className="font-medium">{c.reward}</span></p>}
          <p className="text-xs text-muted-foreground mt-1">
            {c.nextPhase ? `Phase ${c.nextPhase} is now unlocked.` : 'Every phase is done. Project complete!'}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems(p => p.slice(1))}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
