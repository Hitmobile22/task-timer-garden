import { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Link2, Plus, StickyNote as StickyIcon } from 'lucide-react';
import { useStickyNotes, type LinkTarget } from '@/hooks/useStickyNotes';
import { StickyCard } from './StickyCard';
import { StickyLinkSearch } from './StickyLinkSearch';

const KEY = 'sticky-tray-open';

export function StickyTray() {
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) !== '0');
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [link, setLink] = useState<LinkTarget | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const dragId = useRef<number | null>(null);
  const { list, targets, add, update, remove, reorder, queue } = useStickyNotes();
  const notes = list.data || [];
  const items = targets.data?.items || [];
  const colors = targets.data?.colors;

  const toggle = () => setOpen(o => { localStorage.setItem(KEY, o ? '0' : '1'); return !o; });
  const save = () => {
    const content = text.replace(/@\S*$/, '').trim();
    if (!content) return setAdding(false);
    add.mutate({ content, project_id: link?.kind === 'project' ? link.id : null, task_id: link?.kind === 'task' ? link.id : null });
    setText(''); setLink(null); setAdding(false);
  };
  const findLink = (n: { project_id: number | null; task_id: number | null }) =>
    items.find(i => (n.task_id && i.kind === 'task' && i.id === n.task_id) || (n.project_id && i.kind === 'project' && i.id === n.project_id));

  return (
    <section className="px-2 md:px-0 pb-8">
      <button onClick={toggle} className="sticky-tray-toggle mx-auto flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold">
        <StickyIcon className="h-4 w-4" /> Sticky notes ({notes.length})
        <ChevronDown className={`h-4 w-4 transition-transform duration-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          {open && (
            <div className="sticky-tray mt-3 flex gap-4 overflow-x-auto px-4 py-5 snap-x">
              {adding ? (
                <div className="sticky-note shrink-0 w-52 h-28 p-2 animate-sticky-in">
                  <textarea
                    autoFocus value={text} placeholder="Remind me to… (@ to link)"
                    className="w-full h-16 resize-none bg-transparent text-sm text-sticky-ink placeholder:text-sticky-ink/50 outline-none"
                    onChange={e => { setText(e.target.value); if (/(^|\s)@$/.test(e.target.value)) setLinkOpen(true); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') { setAdding(false); setText(''); setLink(null); } }}
                  />
                  <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex max-w-full items-center gap-1 rounded-full bg-sticky-ink/10 px-2 py-0.5 text-[11px] text-sticky-ink">
                        <Link2 className="h-3 w-3 shrink-0" /><span className="truncate">{link ? link.name : 'Link project/task'}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <StickyLinkSearch items={items} onPick={t => { setLink(t); setLinkOpen(false); setText(s => s.replace(/@$/, '')); }} />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="sticky-add shrink-0 w-28 h-28 flex flex-col items-center justify-center gap-1 text-sm font-medium">
                  <Plus className="h-6 w-6" /> Note
                </button>
              )}
              {notes.map((n, i) => {
                const l = findLink(n);
                return (
                  <StickyCard
                    key={n.id} note={n} index={i} link={l} targets={items}
                    tint={l?.listId && colors?.get(l.listId) ? colors.get(l.listId) : null}
                    queuing={queue.isPending && queue.variables?.id === n.id}
                    onQueue={() => queue.mutate(n)}
                    onSave={p => update.mutate({ id: n.id, ...p })}
                    onDelete={() => remove.mutate(n.id)}
                    dragProps={{
                      draggable: true,
                      onDragStart: () => { dragId.current = n.id; },
                      onDragOver: e => e.preventDefault(),
                      onDrop: () => {
                        const from = dragId.current; dragId.current = null;
                        if (from == null || from === n.id) return;
                        const ids = notes.map(x => x.id).filter(id => id !== from);
                        ids.splice(ids.indexOf(n.id), 0, from);
                        reorder.mutate(ids);
                      },
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
