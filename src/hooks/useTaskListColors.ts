
import { useMemo } from 'react';

export const useTaskListColors = (taskListId: number | null, taskLists: any[]) => {
  return useMemo(() => {
    if (!taskListId || !taskLists) return null;
    const taskList = taskLists.find(list => list.id === taskListId);
    return taskList?.color || null;
  }, [taskListId, taskLists]);
};
