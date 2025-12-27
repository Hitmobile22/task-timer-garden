import React, { useState, useCallback } from 'react';
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
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
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

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
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

          <TabsContent value="all" className="mt-4">
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg border-muted-foreground/25">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">
                Full import (Lists, Projects, Tasks, Subtasks) coming soon.
              </p>
            </div>
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
          <Button 
            onClick={handleImport} 
            disabled={parsedRows.length === 0 || isImporting || activeTab === 'all'}
          >
            {isImporting ? 'Importing...' : `Import ${parsedRows.length} Project${parsedRows.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
