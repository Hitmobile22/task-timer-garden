import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListChecks, X } from 'lucide-react';
import type { Task } from '@/types/task.types';
import { useState } from 'react';

interface Props {
  enabled: boolean; count: number; busy: boolean; phasedCount: number;
  onToggle: () => void; onSelectAll: () => void; onClear: () => void;
  onProgress: (status: Task['Progress'], includeSubtasks: boolean) => void;
  onClearDates: () => void;
}

export function TaskBulkToolbar({ enabled, count, busy, phasedCount, onToggle, onSelectAll, onClear, onProgress, onClearDates }: Props) {
  const [status, setStatus] = useState<Task['Progress']>('Not started');
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  return <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
    <Button variant={enabled ? 'secondary' : 'outline'} onClick={onToggle} disabled={busy}>
      {enabled ? <X className="mr-2 h-4 w-4" /> : <ListChecks className="mr-2 h-4 w-4" />}
      {enabled ? 'Exit bulk edit' : 'Bulk edit'}
    </Button>
    {enabled && <>
      <span className="text-sm text-muted-foreground">{count} selected</span>
      <Button variant="ghost" onClick={onSelectAll} disabled={busy}>Select all shown</Button>
      <Button variant="ghost" onClick={onClear} disabled={busy || !count}>Clear selection</Button>
      <Select value={status} onValueChange={v => setStatus(v as Task['Progress'])} disabled={busy}>
        <SelectTrigger className="w-[160px]" aria-label="Bulk progress"><SelectValue /></SelectTrigger>
        <SelectContent>{(['Not started', 'In progress', 'Completed', 'Backlog'] as const).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includeSubtasks} onCheckedChange={v => setIncludeSubtasks(v === true)} disabled={busy} />
        Include subtasks
      </label>
      <Button onClick={() => onProgress(status, includeSubtasks)} disabled={busy || !count}>Apply status</Button>
      <Button variant="outline" onClick={onClearDates} disabled={busy || !phasedCount}>Clear phased start dates</Button>
    </>}
  </div>;
}