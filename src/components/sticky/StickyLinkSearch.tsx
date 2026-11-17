import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { LinkTarget } from '@/hooks/useStickyNotes';
import { FolderKanban, ListTodo, X } from 'lucide-react';

export function StickyLinkSearch({ items, onPick }: { items: LinkTarget[]; onPick: (t: LinkTarget | null) => void }) {
  const projects = items.filter(i => i.kind === 'project');
  const tasks = items.filter(i => i.kind === 'task');
  return (
    <Command className="w-72">
      <CommandInput placeholder="Find a project or task…" autoFocus />
      <CommandList className="max-h-64">
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup>
          <CommandItem value="__none" onSelect={() => onPick(null)}><X className="mr-2 h-4 w-4" />No link</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Projects">
          {projects.map(p => (
            <CommandItem key={`p${p.id}`} value={`project ${p.name} ${p.id}`} onSelect={() => onPick(p)}>
              <FolderKanban className="mr-2 h-4 w-4" />{p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Tasks">
          {tasks.slice(0, 300).map(t => (
            <CommandItem key={`t${t.id}`} value={`task ${t.name} ${t.id}`} onSelect={() => onPick(t)}>
              <ListTodo className="mr-2 h-4 w-4" />{t.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
