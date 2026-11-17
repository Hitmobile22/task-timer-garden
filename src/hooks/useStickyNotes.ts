import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { estTodayWindow } from '@/utils/estDayWindow';
import { nextOpenSlot, stickyTaskListId, STICKY_TASK_MINUTES } from '@/utils/stickyQueue';

export type StickyNote = {
  id: number; content: string; project_id: number | null; task_id: number | null;
  color: string | null; sort_order: number; is_archived: boolean; last_queued_at: string | null;
};
export type LinkTarget = { kind: 'project' | 'task'; id: number; name: string; listId: number | null };

// The table is new; cast until generated types refresh.
const notes = () => (supabase as any).from('sticky_notes');

export function useStickyNotes() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['sticky-notes'] });

  const list = useQuery({
    queryKey: ['sticky-notes'],
    queryFn: async () => {
      const { data, error } = await notes().select('*').eq('is_archived', false).order('sort_order').order('id');
      if (error) throw error;
      return (data || []) as StickyNote[];
    },
  });

  const targets = useQuery({
    queryKey: ['sticky-link-targets'],
    queryFn: async () => {
      const [p, t, l] = await Promise.all([
        supabase.from('Projects').select('id, "Project Name", task_list_id').eq('archived', false).neq('progress', 'Completed'),
        supabase.from('Tasks').select('id, "Task Name", task_list_id').eq('archived', false).neq('Progress', 'Completed').limit(1000),
        supabase.from('TaskLists').select('id, color'),
      ]);
      const colors = new Map((l.data || []).map(x => [x.id, x.color]));
      const out: LinkTarget[] = [
        ...(p.data || []).map(x => ({ kind: 'project' as const, id: x.id, name: x['Project Name'], listId: x.task_list_id })),
        ...(t.data || []).map(x => ({ kind: 'task' as const, id: x.id, name: x['Task Name'] || 'Untitled', listId: x.task_list_id })),
      ];
      return { items: out, colors };
    },
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: async (n: { content: string; project_id?: number | null; task_id?: number | null }) => {
      const order = (list.data?.length ? Math.max(...list.data.map(x => x.sort_order)) : 0) + 1;
      const { error } = await notes().insert({ ...n, sort_order: order });
      if (error) throw error;
    },
    onSuccess: refresh, onError: () => toast.error('Could not save note'),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<StickyNote> & { id: number }) => {
      const { error } = await notes().update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => { const { error } = await notes().delete().eq('id', id); if (error) throw error; },
    onSuccess: refresh,
  });

  const reorder = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id, i) => notes().update({ sort_order: i + 1 }).eq('id', id)));
    },
    onSuccess: refresh,
  });

  const queue = useMutation({
    mutationFn: async (note: StickyNote) => {
      const { start, end } = estTodayWindow();
      const { data: today } = await supabase.from('Tasks').select('date_started, date_due, Progress')
        .eq('archived', false).gte('date_due', start.toISOString()).lt('date_started', end.toISOString());
      const slot = nextOpenSlot(today || []);
      const due = new Date(slot.getTime() + STICKY_TASK_MINUTES * 60000);

      if (note.task_id) {
        const { data: t } = await supabase.from('Tasks').select('id, date_started').eq('id', note.task_id).maybeSingle();
        if (!t) throw new Error('Linked task no longer exists');
        const s = t.date_started ? new Date(t.date_started).getTime() : NaN;
        if (!(s >= start.getTime() && s < end.getTime())) {
          const { error } = await supabase.from('Tasks').update({ date_started: slot.toISOString(), date_due: due.toISOString() }).eq('id', t.id);
          if (error) throw error;
        }
      } else {
        let listId: number | null = null;
        if (note.project_id) {
          const { data: p } = await supabase.from('Projects').select('task_list_id').eq('id', note.project_id).maybeSingle();
          listId = p?.task_list_id ?? null;
        }
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase.from('Tasks').insert({
          'Task Name': note.content, Progress: 'Not started', order: 0, archived: false,
          task_list_id: stickyTaskListId(listId), project_id: note.project_id ?? null,
          date_started: slot.toISOString(), date_due: due.toISOString(),
          details: { taskDuration: STICKY_TASK_MINUTES }, user_id: auth.user!.id,
        });
        if (error) throw error;
      }
      await notes().update({ last_queued_at: new Date().toISOString() }).eq('id', note.id);
    },
    onSuccess: () => {
      refresh();
      ['tasks', 'active-tasks'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      toast.success('Added to today’s queue');
    },
    onError: (e: any) => toast.error(e?.message || 'Could not queue note'),
  });

  return { list, targets, add, update, remove, reorder, queue };
}
