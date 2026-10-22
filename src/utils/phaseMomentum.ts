/** Only a phased task with genuinely unfinished subtasks needs the momentum prompt. */
export function needsPhaseMomentum(
  phase: number | null | undefined,
  subtasks: { Progress?: string | null }[],
): boolean {
  return phase != null && subtasks.some(s => s.Progress !== 'Completed');
}

/** Save child completion first; never report the parent done after a failed child write. */
export async function completeMomentumItems(
  completeSubtasks: () => Promise<void>,
  completeTask: () => Promise<void>,
): Promise<void> {
  await completeSubtasks();
  await completeTask();
}