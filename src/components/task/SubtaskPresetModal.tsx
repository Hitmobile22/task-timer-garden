import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient, useQuery } from '@tanstack/react-query';

interface SubtaskPreset {
  id: number;
  name: string;
  subtask_names: string[];
  user_id: string;
}

interface SubtaskPresetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SubtaskPresetModal = ({ open, onOpenChange }: SubtaskPresetModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [presetName, setPresetName] = useState('');
  const [subtaskNames, setSubtaskNames] = useState<string[]>(['']);
  const [editingPreset, setEditingPreset] = useState<SubtaskPreset | null>(null);

  const { data: presets, isLoading } = useQuery({
    queryKey: ['subtask-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtask_presets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SubtaskPreset[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setPresetName('');
    setSubtaskNames(['']);
    setEditingPreset(null);
  };

  const handleAddSubtaskField = () => {
    setSubtaskNames([...subtaskNames, '']);
  };

  const handleRemoveSubtaskField = (index: number) => {
    if (subtaskNames.length > 1) {
      setSubtaskNames(subtaskNames.filter((_, i) => i !== index));
    }
  };

  const handleSubtaskNameChange = (index: number, value: string) => {
    const updated = [...subtaskNames];
    updated[index] = value;
    setSubtaskNames(updated);
  };

  const handleSave = async () => {
    try {
      if (!presetName.trim()) {
        toast.error('Please enter a preset name');
        return;
      }

      const filteredSubtasks = subtaskNames.filter(name => name.trim());
      if (filteredSubtasks.length === 0) {
        toast.error('Please add at least one subtask');
        return;
      }

      if (editingPreset) {
        const { error } = await supabase
          .from('subtask_presets')
          .update({
            name: presetName.trim(),
            subtask_names: filteredSubtasks,
          })
          .eq('id', editingPreset.id);

        if (error) throw error;
        toast.success('Preset updated successfully');
      } else {
        const { error } = await supabase
          .from('subtask_presets')
          .insert([{
            name: presetName.trim(),
            subtask_names: filteredSubtasks,
            user_id: user?.id,
          }]);

        if (error) throw error;
        toast.success('Preset created successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['subtask-presets'] });
      resetForm();
    } catch (error) {
      console.error('Error saving preset:', error);
      toast.error('Failed to save preset');
    }
  };

  const handleEdit = (preset: SubtaskPreset) => {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setSubtaskNames(preset.subtask_names.length > 0 ? preset.subtask_names : ['']);
  };

  const handleDelete = async (presetId: number) => {
    try {
      const { error } = await supabase
        .from('subtask_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['subtask-presets'] });
      toast.success('Preset deleted');
      
      if (editingPreset?.id === presetId) {
        resetForm();
      }
    } catch (error) {
      console.error('Error deleting preset:', error);
      toast.error('Failed to delete preset');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPreset ? 'Edit Subtask Preset' : 'Subtask Presets'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Presets List */}
          {!editingPreset && presets && presets.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Presets</Label>
              <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                {presets.map((preset) => (
                  <div key={preset.id} className="flex items-center justify-between p-3">
                    <div className="flex-1">
                      <p className="font-medium">{preset.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {preset.subtask_names.length} subtask(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(preset)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(preset.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create/Edit Form */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="presetName">
                {editingPreset ? 'Edit Preset Name' : 'New Preset Name'}
              </Label>
              <Input
                id="presetName"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Enter preset name"
              />
            </div>

            <div className="space-y-2">
              <Label>Subtasks</Label>
              <div className="space-y-2">
                {subtaskNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={name}
                      onChange={(e) => handleSubtaskNameChange(index, e.target.value)}
                      placeholder={`Subtask ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSubtaskField(index)}
                      disabled={subtaskNames.length === 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddSubtaskField}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Subtask
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          {editingPreset && (
            <Button variant="ghost" onClick={resetForm}>
              Cancel Edit
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave}>
            {editingPreset ? 'Update Preset' : 'Create Preset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
