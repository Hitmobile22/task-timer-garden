import { addDays, parse, isValid } from 'date-fns';

export interface ProjectCSVRow {
  'Project Name': string;
  'Start Date'?: string;
  'Due Date'?: string;
  'List'?: string;
  'Description'?: string;
  'Recurring'?: string;
  'Progress'?: string;
  'Progressive Mode'?: string;
  'Days of Week'?: string;
}

export interface ParsedProjectRow {
  projectName: string;
  startDate: Date;
  dueDate: Date;
  listName: string;
  description: string | null;
  isRecurring: boolean;
  recurringTaskCount: number;
  progress: 'Not started' | 'In progress' | 'Completed' | 'Backlog';
  progressiveMode: boolean;
  daysOfWeek: string[];
  warnings: string[];
}

export interface CSVParseResult {
  rows: ParsedProjectRow[];
  errors: string[];
}

const VALID_PROGRESS_VALUES = ['Not started', 'In progress', 'Completed', 'Backlog'] as const;
const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n');
  if (lines.length < 1) {
    return { headers: [], rows: [] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0].trim() === '')) continue;
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

export function getDefaultDates(): { startDate: Date; dueDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = addDays(today, 2);
  return { startDate: today, dueDate };
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Try common date formats
  const formats = ['yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy', 'dd/MM/yyyy'];
  
  for (const fmt of formats) {
    try {
      const parsed = parse(dateStr.trim(), fmt, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  
  // Try native Date parsing as fallback
  const nativeDate = new Date(dateStr);
  if (isValid(nativeDate)) {
    return nativeDate;
  }
  
  return null;
}

export function parseDaysOfWeek(daysStr: string | undefined): string[] {
  if (!daysStr || daysStr.trim() === '') {
    return VALID_DAYS;
  }
  
  const days = daysStr.split(',').map(d => d.trim());
  const validDays: string[] = [];
  
  for (const day of days) {
    const normalizedDay = VALID_DAYS.find(
      vd => vd.toLowerCase() === day.toLowerCase()
    );
    if (normalizedDay) {
      validDays.push(normalizedDay);
    }
  }
  
  return validDays.length > 0 ? validDays : VALID_DAYS;
}

export function validateProjectRow(
  row: Record<string, string>,
  rowIndex: number
): { parsed: ParsedProjectRow | null; error: string | null } {
  const warnings: string[] = [];
  
  // Check required field
  const projectName = row['Project Name']?.trim();
  if (!projectName) {
    return { 
      parsed: null, 
      error: `Row ${rowIndex + 1}: Missing required field "Project Name"` 
    };
  }
  
  // Parse dates with defaults
  const defaults = getDefaultDates();
  let startDate = parseDate(row['Start Date'] || '');
  let dueDate = parseDate(row['Due Date'] || '');
  
  if (!startDate) {
    startDate = defaults.startDate;
    if (row['Start Date']?.trim()) {
      warnings.push(`Invalid start date, using today`);
    }
  }
  
  if (!dueDate) {
    dueDate = defaults.dueDate;
    if (row['Due Date']?.trim()) {
      warnings.push(`Invalid due date, using today + 2 days`);
    }
  }
  
  // Parse list name (default to "Default")
  const listName = row['List']?.trim() || 'Default';
  
  // Parse description
  const description = row['Description']?.trim() || null;
  
  // Parse recurring
  const recurringValue = row['Recurring']?.trim();
  let isRecurring = false;
  let recurringTaskCount = 1;
  
  if (recurringValue && recurringValue !== '') {
    const parsed = parseInt(recurringValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      isRecurring = true;
      recurringTaskCount = parsed;
    } else if (recurringValue !== '0' && recurringValue !== '') {
      warnings.push(`Invalid recurring value "${recurringValue}", treating as disabled`);
    }
  }
  
  // Parse progress
  const progressValue = row['Progress']?.trim();
  let progress: typeof VALID_PROGRESS_VALUES[number] = 'Not started';
  
  if (progressValue) {
    const matchedProgress = VALID_PROGRESS_VALUES.find(
      v => v.toLowerCase() === progressValue.toLowerCase()
    );
    if (matchedProgress) {
      progress = matchedProgress;
    } else {
      warnings.push(`Invalid progress "${progressValue}", using "Not started"`);
    }
  }
  
  // Parse progressive mode
  const progressiveModeValue = row['Progressive Mode']?.trim().toLowerCase();
  const progressiveMode = progressiveModeValue === 'yes' || progressiveModeValue === 'true';
  
  // Parse days of week
  const daysOfWeek = parseDaysOfWeek(row['Days of Week']);
  
  return {
    parsed: {
      projectName,
      startDate,
      dueDate,
      listName,
      description,
      isRecurring,
      recurringTaskCount,
      progress,
      progressiveMode,
      daysOfWeek,
      warnings,
    },
    error: null,
  };
}

export function resolveTaskListId(
  listName: string,
  taskLists: Array<{ id: number; name: string }>
): number | null {
  const match = taskLists.find(
    list => list.name.toLowerCase() === listName.toLowerCase()
  );
  return match?.id ?? null;
}

export function generateExampleCSV(): string {
  const headers = [
    'Project Name',
    'Start Date',
    'Due Date',
    'List',
    'Description',
    'Recurring',
    'Progress',
    'Progressive Mode',
    'Days of Week',
  ];
  
  const rows = [
    [
      'Example Project 1',
      '2025-12-28',
      '2025-12-30',
      'Default',
      'This is the project description',
      '3',
      'Not started',
      'No',
      '"Monday,Tuesday,Wednesday,Thursday,Friday"',
    ],
    [
      'Example Project 2',
      '',
      '',
      'Default',
      '',
      '',
      'In progress',
      '',
      '',
    ],
    [
      'Minimal Project',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
  ];
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function downloadExampleCSV(): void {
  const csvContent = generateExampleCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'projects_import_example.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
