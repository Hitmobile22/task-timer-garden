import React, { useState, useCallback, useRef } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import {
  parseFullImport,
  toDetails,
  downloadFullExampleCSV,
  FullImportResult,
  FullTask,
} from '@/utils/csvFullImportUtils';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  parseCSV,
  validateProjectRow,
  resolveTaskListId,
  downloadExampleCSV,
  ParsedProjectRow,
} from '@/utils/csvImportUtils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CSVUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskLists: Array<{ id: number; name: string }>;
}

export function CSVUploadModal({ open, onOpenChange, taskLists }: CSVUploadModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'projects'>('projects');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProjectRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [fullResult, setFullResult] = useState<FullImportResult | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // Always read the latest task lists (avoids stale empty list from memoized drop handler)
  const taskListsRef = useRef(taskLists);
  taskListsRef.current = taskLists;

  // Re-parse the All-tab file once task lists finish loading
  React.useEffect(() => {
    if (!fullFile || taskLists.length === 0) return;
    let cancelled = false;
    fullFile.text().then(text => {
      if (!cancelled) setFullResult(parseFullImport(text, taskLists));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [taskLists, fullFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    if (activeTabRef.current === 'all') {
      setFullFile(selectedFile);
      try {
        setFullResult(parseFullImport(await selectedFile.text(), taskListsRef.current));
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Failed to parse CSV file');
      }
      return;
    }

    setFile(selectedFile);
    
    
    try {
      const text = await selectedFile.text();
      const { rows } = parseCSV(text);
      
      const parsed: ParsedProjectRow[] = [];
      const errors: string[] = [];

      rows.forEach((row, index) => {
        const result = validateProjectRow(row, index);
        if (result.error) {
          errors.push(result.error);
        } else if (result.parsed) {
          parsed.push(result.parsed);
        }
      });

      setParsedRows(parsed);
      setParseErrors(errors);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse CSV file');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to import');
        return;
      }

      for (const row of parsedRows) {
        try {
          // Resolve task list ID
          let taskListId = resolveTaskListId(row.listName, taskLists);
          
          // If list not found, use first available list or create default behavior
          if (!taskListId && taskLists.length > 0) {
            const defaultList = taskLists.find(l => l.name.toLowerCase() === 'default');
            taskListId = defaultList?.id || taskLists[0].id;
          }

          // Prepare description in the correct format
          const details = row.description ? {
            description: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: row.description }]
                }
              ]
            }
          } : null;

          // Create project
          const { data: newProject, error: projectError } = await supabase
            .from('Projects')
            .insert({
              'Project Name': row.projectName,
              date_started: row.startDate.toISOString(),
              date_due: row.dueDate.toISOString(),
              task_list_id: taskListId,
              details: details,
              isRecurring: row.isRecurring,
              recurringTaskCount: row.recurringTaskCount,
              progress: row.progress,
              user_id: user.id,
              sort_order: 0,
            })
            .select()
            .single();

          if (projectError) throw projectError;

          // Create recurring project settings if progressive mode is enabled
          if (row.progressiveMode && newProject) {
            const { error: settingsError } = await supabase
              .from('recurring_project_settings')
              .insert({
                project_id: newProject.id,
                progressive_mode: true,
                days_of_week: row.daysOfWeek,
                user_id: user.id,
              });

            if (settingsError) {
              console.error('Error creating recurring settings:', settingsError);
            }
          }

          successCount++;
        } catch (error) {
          console.error('Error importing row:', error);
          errorCount++;
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} project${successCount > 1 ? 's' : ''}`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} project${errorCount > 1 ? 's' : ''}`);
      }

      // Reset state
      setFile(null);
      setParsedRows([]);
      setParseErrors([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import projects');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFullImport = async () => {
    if (!fullResult) return;
    setIsImporting(true);
    let failed = 0;
    const done = { projects: 0, tasks: 0, subtasks: 0 };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in to import'); return; }

      const insertTasks = async (tasks: FullTask[], projectId: number | null) => {
        for (let i = 0; i < tasks.length; i++) {
          const t = tasks[i];
          const { data: newTask, error } = await supabase.from('Tasks').insert({
            'Task Name': t.name,
            Progress: t.progress,
            date_started: t.start.toISOString(),
            date_due: t.due.toISOString(),
            project_id: projectId,
            task_list_id: t.listId,
            details: toDetails(t.description),
            user_id: user.id,
            order: i,
            sort_order: i,
          }).select('id').single();
          if (error || !newTask) { console.error(error); failed++; continue; }
          done.tasks++;
          if (t.subtasks.length) {
            const { error: subErr } = await supabase.from('subtasks').insert(
              t.subtasks.map((s, k) => ({
                'Task Name': s.name, 'Parent Task ID': newTask.id,
                Progress: s.progress, sort_order: k, user_id: user.id,
              }))
            );
            if (subErr) { console.error(subErr); failed += t.subtasks.length; }
            else done.subtasks += t.subtasks.length;
          }
        }
      };

      for (const p of fullResult.projects) {
        const { data: newProject, error } = await supabase.from('Projects').insert({
          'Project Name': p.name,
          progress: p.progress,
          date_started: p.start.toISOString(),
          date_due: p.due.toISOString(),
          task_list_id: p.listId,
          details: toDetails(p.description),
          user_id: user.id,
          sort_order: 0,
        }).select('id').single();
        if (error || !newProject) { console.error(error); failed++; continue; }
        done.projects++;
        await insertTasks(p.tasks, newProject.id);
      }
      await insertTasks(fullResult.standaloneTasks, null);

      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries();

      toast.success(`Imported ${done.projects} projects, ${done.tasks} tasks, ${done.subtasks} subtasks`);
      if (failed > 0) toast.error(`${failed} item${failed > 1 ? 's' : ''} failed to import`);
      resetState();
      onOpenChange(false);
    } catch (e) {
      console.error('Full import error:', e);
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setFullFile(null);
    setFullResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetState();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload CSV</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'projects')} className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="projects">Projects/Events</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 flex flex-col gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <h4 className="font-semibold mb-2">How to use:</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Each row is a Project, Task, or Subtask (set in the "Type" column)</li>
                <li>Tasks link to a project by its name in "Project" (leave it blank for a standalone task)</li>
                <li>Subtasks link to a task by its name in "Task"</li>
                <li>Tasks without dates are scheduled one after another using "Duration" (minutes, default 25)</li>
              </ol>
              <div className="mt-3 p-2 bg-background rounded border">
                <p className="font-medium text-xs mb-1">Columns:</p>
                <p className="text-xs text-muted-foreground">
                  <strong>Type</strong> (required) | <strong>Name</strong> (required) | Project | Task | List | Start Date | Due Date | Duration | Progress | Description
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Dates: YYYY-MM-DD or MM/DD/YYYY, optionally with time (e.g. 2026-10-01 09:00, Eastern time). Progress: Not started, In progress, Completed, Backlog. Use quotes around text that contains commas.
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={downloadFullExampleCSV} className="w-fit">
              <Download className="h-4 w-4 mr-2" />
              Download Example CSV
            </Button>

            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {fullFile ? fullFile.name : 'Drag and drop a CSV file, or click to select'}
              </p>
            </div>

            {fullResult && (
              <ScrollArea className="h-[220px] rounded-lg border">
                <div className="p-4 space-y-4">
                  {fullResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="font-medium text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> Errors ({fullResult.errors.length})
                      </h4>
                      {fullResult.errors.map((e, i) => <p key={i} className="text-sm text-destructive">{e}</p>)}
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="font-medium text-primary flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Ready: {fullResult.counts.projects} projects, {fullResult.counts.tasks} tasks, {fullResult.counts.subtasks} subtasks
                    </h4>
                    {fullResult.projects.map((p, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                        <div className="font-medium flex items-center gap-2"><FileText className="h-3 w-3" />{p.name}</div>
                        {p.warnings.length > 0 && <div className="text-xs text-muted-foreground mt-1">⚠️ {p.warnings.join(', ')}</div>}
                        {p.tasks.map((t, j) => <TaskPreview key={j} task={t} />)}
                      </div>
                    ))}
                    {fullResult.standaloneTasks.length > 0 && (
                      <div className="text-sm p-2 bg-muted/50 rounded">
                        <div className="font-medium">Standalone tasks</div>
                        {fullResult.standaloneTasks.map((t, j) => <TaskPreview key={j} task={t} />)}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="projects" className="mt-4 flex flex-col gap-4">
            {/* Instructions */}
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <h4 className="font-semibold mb-2">How to use:</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Download the example CSV to see the required format</li>
                <li>Edit the CSV with your projects (only "Project Name" is required)</li>
                <li>Upload your CSV file and preview the data</li>
                <li>Click Import to create your projects</li>
              </ol>
              <div className="mt-3 p-2 bg-background rounded border">
                <p className="font-medium text-xs mb-1">Columns:</p>
                <p className="text-xs text-muted-foreground">
                  <strong>Project Name</strong> (required) | Start Date | Due Date | List | Description | Recurring | Progress | Progressive Mode | Days of Week
                </p>
              </div>
            </div>

            {/* Download Example Button */}
            <Button
              variant="outline"
              onClick={downloadExampleCSV}
              className="w-fit"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Example CSV
            </Button>

            {/* File Upload Area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : 'Drag and drop a CSV file, or click to select'}
              </p>
            </div>

            {/* Parse Results */}
            {(parsedRows.length > 0 || parseErrors.length > 0) && (
              <ScrollArea className="h-[200px] rounded-lg border">
                <div className="p-4 space-y-4">
                  {parseErrors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Errors ({parseErrors.length})
                      </h4>
                      {parseErrors.map((error, i) => (
                        <p key={i} className="text-sm text-destructive">{error}</p>
                      ))}
                    </div>
                  )}
                  
                  {parsedRows.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-600 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Ready to import ({parsedRows.length})
                      </h4>
                      <div className="space-y-1">
                        {parsedRows.map((row, i) => (
                          <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                            <span className="font-medium">{row.projectName}</span>
                            {row.isRecurring && (
                              <span className="ml-2 text-xs text-blue-500">
                                Recurring: {row.recurringTaskCount}
                              </span>
                            )}
                            {row.progressiveMode && (
                              <span className="ml-2 text-xs text-purple-500">
                                Progressive
                              </span>
                            )}
                            {row.warnings.length > 0 && (
                              <div className="text-xs text-amber-600 mt-1">
                                ⚠️ {row.warnings.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === 'all' ? (
            <Button
              onClick={handleFullImport}
              disabled={!fullResult || (fullResult.counts.projects + fullResult.counts.tasks) === 0 || isImporting}
            >
              {isImporting
                ? 'Importing...'
                : `Import ${fullResult?.counts.projects ?? 0} projects, ${fullResult?.counts.tasks ?? 0} tasks, ${fullResult?.counts.subtasks ?? 0} subtasks`}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={parsedRows.length === 0 || isImporting}>
              {isImporting ? 'Importing...' : `Import ${parsedRows.length} Project${parsedRows.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskPreview({ task }: { task: FullTask }) {
  return (
    <div className="ml-4 mt-1 text-xs">
      <div>
        • {task.name}{' '}
        <span className="text-muted-foreground">
          ({formatInTimeZone(task.start, 'America/New_York', 'MMM d h:mm a')} – {formatInTimeZone(task.due, 'America/New_York', 'h:mm a')})
        </span>
      </div>
      {task.warnings.length > 0 && <div className="ml-3 text-muted-foreground">⚠️ {task.warnings.join(', ')}</div>}
      {task.subtasks.map((s, k) => <div key={k} className="ml-6 text-muted-foreground">– {s.name}</div>)}
    </div>
  );
}
