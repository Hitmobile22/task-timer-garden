import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  taskName: string;
  upcomingCount: number;
  onExtend: () => void;
  onMoveBehind: (n: number) => void;
  onLeave: () => void;
}

/** Shown when time runs out on a phased task that still has unfinished subtasks. */
export const MomentumDialog: React.FC<Props> = ({ open, taskName, upcomingCount, onExtend, onMoveBehind, onLeave }) => (
  <Dialog open={open} onOpenChange={o => { if (!o) onLeave(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Keep momentum</DialogTitle>
        <DialogDescription>
          Time's up on "{taskName}", but it isn't finished. No problem, pick how to keep the chain going.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Button onClick={onExtend}>Extend 10 min</Button>
        {[1, 2, 3].filter(n => n <= upcomingCount).map(n => (
          <Button key={n} variant="outline" onClick={() => onMoveBehind(n)}>
            Move behind the next {n === 1 ? 'task' : `${n} tasks`}
          </Button>
        ))}
      </div>
      <DialogFooter><Button variant="ghost" onClick={onLeave}>Leave as is</Button></DialogFooter>
    </DialogContent>
  </Dialog>
);
