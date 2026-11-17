import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Archive, CalendarPlus, Check, Link2, Pencil, Trash2 } from 'lucide-react';
import type { LinkTarget, StickyNote } from '@/hooks/useStickyNotes';
import { StickyLinkSearch } from './StickyLinkSearch';
import { estTodayWindow } from '@/utils/estDayWindow';

const tilts = ['-rotate-[1.5deg]', 'rotate-[1deg]', '-rotate-[0.5deg]', 'rotate-[1.75deg]', 'rotate-0'];

type Props = {
  note: StickyNote; index: number; link?: LinkTarget; tint?: string | null; targets: LinkTarget[];
  onQueue: () => void; onSave: (p: Partial<StickyNote>) => void; onDelete: () => void; queuing: boolean;
  dragProps: React.HTMLAttributes<HTMLDivElement> & { draggable: boolean };
};

export function StickyCard({ note, index, link, tint, targets, onQueue, onSave, onDelete, queuing, dragProps }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [text, setText] = useState(note.content);
  const { start } = estTodayWindow();
  const queuedToday = !!note.last_queued_at && new Date(note.last_queued_at) >= start;

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) { setEditing(false); setLinking(false); } }}>
      <PopoverTrigger asChild>
        <div
          {...dragProps}
          role="button"
          tabIndex={0}
          style={{ animationDelay: `${index * 60}ms`, ...(tint ? { ['--sticky-tint' as any]: tint } : {}) }}
          className={`sticky-note group relative shrink-0 w-44 h-28 p-3 pt-4 cursor-pointer select-none animate-sticky-in opacity-0 [animation-fill-mode:forwards] ${tilts[index % tilts.length]} hover:rotate-0 hover:-translate-y-1 transition-transform duration-300`}
        >
          <span className="sticky-pin" aria-hidden />
          <p className="text-sm leading-snug font-medium line-clamp-3 text-sticky-ink">{note.content}</p>
          <div className="absolute bottom-2 left-3 right-3 flex items-center gap-1 text-[10px] text-sticky-ink/70">
            {link && <span className="truncate rounded-full bg-sticky-ink/10 px-1.5 py-0.5">{link.kind === 'project' ? '◆' : '•'} {link.name}</span>}
            {queuedToday && <span className="ml-auto flex items-center gap-0.5 shrink-0"><Check className="h-3 w-3" />Queued</span>}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {linking ? (
          <StickyLinkSearch items={targets} onPick={t => {
            onSave({ project_id: t?.kind === 'project' ? t.id : null, task_id: t?.kind === 'task' ? t.id : null });
            setLinking(false);
          }} />
        ) : (
          <div className="w-72 p-3 space-y-3">
            {editing ? (
              <Textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={4}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) onSave({ content: text.trim() }); setEditing(false); } }} />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {link ? `Linked ${link.kind}: ${link.name}` : 'Not linked — queues into Default list'}
            </p>
            <Button className="w-full" size="sm" disabled={queuing} onClick={() => { onQueue(); setOpen(false); }}>
              <CalendarPlus className="mr-1 h-4 w-4" />{queuing ? 'Queuing…' : 'Queue today'}
            </Button>
            <div className="grid grid-cols-4 gap-1">
              <Button variant="ghost" size="sm" title="Edit" onClick={() => setEditing(e => !e)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" title="Change link" onClick={() => setLinking(true)}><Link2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" title="Archive" onClick={() => onSave({ is_archived: true })}><Archive className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" title="Delete" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
