import { addDays, addMinutes, isValid, parse } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { resolveTaskListId } from './csvImportUtils';

const TZ = 'America/New_York';
const PROGRESS = ['Not started', 'In progress', 'Completed', 'Backlog'] as const;
export type Progress = typeof PROGRESS[number];

export interface FullSubtask { name: string; progress: Progress; }
export interface FullTask {
  name: string; progress: Progress; description: string | null;
  start: Date; due: Date; listId: number | null; subtasks: FullSubtask[]; warnings: string[];
}
export interface FullProject {
  name: string; progress: Progress; description: string | null;
  start: Date; due: Date; listId: number | null; tasks: FullTask[]; warnings: string[];
}
export interface FullImportResult {
  projects: FullProject[]; standaloneTasks: FullTask[]; errors: string[];
  counts: { projects: number; tasks: number; subtasks: number };
}

/** CSV parser supporting quoted fields with commas, escaped quotes and newlines. */
export function parseCSVRobust(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); records.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); records.push(row); }
  if (!records.length) return [];
  const headers = records[0].map(h => h.trim().toLowerCase());
  return records.slice(1)
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function parseDateTime(s: string): Date | null {
  if (!s) return null;
  const fmts = ['yyyy-MM-dd HH:mm', 'yyyy-MM-dd H:mm', 'MM/dd/yyyy HH:mm', 'M/d/yyyy H:mm',
    'M/d/yyyy h:mm a', 'yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy'];
  for (const f of fmts) {
    const p = parse(s, f, new Date(2000, 0, 1));
    if (isValid(p)) return fromZonedTime(p, TZ); // interpret as New York wall time
  }
  return null;
}

function hasTime(s: string) { return /\d:\d/.test(s); }

function todayStartEST(): Date {
  const z = toZonedTime(new Date(), TZ);
  z.setHours(0, 0, 0, 0);
  return fromZonedTime(z, TZ);
}

function atNineEST(d: Date): Date {
  const z = toZonedTime(d, TZ);
  z.setHours(9, 0, 0, 0);
  return fromZonedTime(z, TZ);
}

function normProgress(v: string, warn: string[]): Progress {
  if (!v) return 'Not started';
  const m = PROGRESS.find(p => p.toLowerCase() === v.toLowerCase());
  if (!m) warn.push(`Invalid progress "${v}", using "Not started"`);
  return m ?? 'Not started';
}

export function parseFullImport(
  text: string, taskLists: Array<{ id: number; name: string }>
): FullImportResult {
  const rows = parseCSVRobust(text);
  const errors: string[] = [];
  const projects: FullProject[] = [];
  const projectByName = new Map<string, FullProject>();
  const allTasks: { task: FullTask; row: number; projectName: string }[] = [];
  const subRows: { row: number; name: string; taskName: string; progress: Progress }[] = [];

  const defaultList = () => {
    const d = taskLists.find(l => l.name.toLowerCase() === 'default');
    return d?.id ?? taskLists[0]?.id ?? null;
  };
  const listFor = (name: string, fallback: number | null, warn: string[]) => {
    if (!name) return fallback ?? defaultList();
    const id = resolveTaskListId(name, taskLists);
    if (id == null) { warn.push(`List "${name}" not found, using default`); return fallback ?? defaultList(); }
    return id;
  };

  // Pass 1: projects
  rows.forEach((r, i) => {
    const n = i + 2;
    const type = (r['type'] || '').toLowerCase();
    const name = r['name'] || '';
    if (!['project', 'task', 'subtask'].includes(type)) {
      errors.push(`Row ${n}: Unknown Type "${r['type'] || ''}" (use Project, Task or Subtask)`); return;
    }
    if (!name) { errors.push(`Row ${n}: Missing Name`); return; }
    if (type === 'project') {
      if (projectByName.has(name.toLowerCase())) { errors.push(`Row ${n}: Duplicate project "${name}"`); return; }
      const warnings: string[] = [];
      let start = parseDateTime(r['start date']);
      if (r['start date'] && !start) warnings.push('Invalid start date, using today');
      start = start ?? todayStartEST();
      let due = parseDateTime(r['due date']);
      if (r['due date'] && !due) warnings.push('Invalid due date, using start + 2 days');
      due = due ?? addDays(start, 2);
      const p: FullProject = {
        name, progress: normProgress(r['progress'], warnings), description: r['description'] || null,
        start, due, listId: listFor(r['list'], null, warnings), tasks: [], warnings,
      };
      projects.push(p); projectByName.set(name.toLowerCase(), p);
    } else if (type === 'task') {
      allTasks.push({ task: null as unknown as FullTask, row: i, projectName: r['project'] || '' });
    } else {
      if (!r['task']) { errors.push(`Row ${n}: Subtask "${name}" needs a Task column value`); return; }
      const warn: string[] = [];
      subRows.push({ row: i, name, taskName: r['task'], progress: normProgress(r['progress'], warn) });
    }
  });

  // Pass 2: tasks (sequential timing per project / standalone group)
  const standaloneTasks: FullTask[] = [];
  const cursor = new Map<string, Date>();
  const builtTasks: { task: FullTask; row: number }[] = [];
  for (const t of allTasks) {
    const r = rows[t.row]; const n = t.row + 2;
    const warnings: string[] = [];
    let project: FullProject | undefined;
    if (t.projectName) {
      project = projectByName.get(t.projectName.toLowerCase());
      if (!project) { errors.push(`Row ${n}: Project "${t.projectName}" not found in file`); continue; }
    }
    const key = project ? project.name.toLowerCase() : '__standalone__';
    const durRaw = r['duration'];
    let dur = 25;
    if (durRaw) {
      const d = parseInt(durRaw, 10);
      if (isNaN(d) || d <= 0) warnings.push(`Invalid duration "${durRaw}", using 25`); else dur = d;
    }
    let start = parseDateTime(r['start date']);
    if (start && !hasTime(r['start date'])) start = atNineEST(start);
    if (r['start date'] && !start) warnings.push('Invalid start date, using previous task end');
    if (!start) {
      start = cursor.get(key) ?? (project ? atNineEST(project.start) : new Date());
    }
    let due = parseDateTime(r['due date']);
    if (due && !hasTime(r['due date'])) due = addMinutes(atNineEST(due), dur);
    if (r['due date'] && !due) warnings.push('Invalid due date, using start + duration');
    if (!due || due <= start) due = addMinutes(start, dur);
    cursor.set(key, due);
    const task: FullTask = {
      name: r['name'], progress: normProgress(r['progress'], warnings),
      description: r['description'] || null, start, due,
      listId: listFor(r['list'], project?.listId ?? null, warnings), subtasks: [], warnings,
    };
    (project ? project.tasks : standaloneTasks).push(task);
    builtTasks.push({ task, row: t.row });
  }

  // Pass 3: subtasks -> nearest task above with that name (else any match)
  for (const s of subRows) {
    const matches = builtTasks.filter(b => b.task.name.toLowerCase() === s.taskName.toLowerCase());
    if (!matches.length) { errors.push(`Row ${s.row + 2}: Task "${s.taskName}" not found for subtask "${s.name}"`); continue; }
    const above = matches.filter(m => m.row < s.row);
    const target = (above.length ? above[above.length - 1] : matches[0]).task;
    target.subtasks.push({ name: s.name, progress: s.progress });
  }

  const tasksAll = builtTasks.map(b => b.task);
  return {
    projects, standaloneTasks, errors,
    counts: {
      projects: projects.length, tasks: tasksAll.length,
      subtasks: tasksAll.reduce((a, t) => a + t.subtasks.length, 0),
    },
  };
}

export function toDetails(description: string | null) {
  if (!description) return null;
  return {
    description: {
      type: 'doc',
      content: description.split(/\r?\n/).map(line => ({
        type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [],
      })),
    },
  };
}

export function downloadFullExampleCSV(): void {
  const csv = [
    'Type,Name,Project,Task,List,Start Date,Due Date,Duration,Progress,Description',
    'Project,Website Launch,,,Default,2026-10-01,2026-10-15,,,Launch the new site',
    'Task,Design mockups,Website Launch,,,2026-10-01 09:00,,60,,"Homepage, about page"',
    'Subtask,Homepage,,Design mockups,,,,,,',
    'Subtask,About page,,Design mockups,,,,,,',
    'Task,Build pages,Website Launch,,,2026-10-03 09:00,,90,,',
    'Subtask,Header,,Build pages,,,,,,',
    'Task,Review copy,,,Default,,,30,Not started,A standalone task',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'full_import_example.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
