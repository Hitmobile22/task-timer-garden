-- Retroactively add subtasks to task 7965 (Winkler Game overdue)
INSERT INTO subtasks ("Task Name", "Parent Task ID", "Progress", "user_id", "sort_order")
VALUES 
  ('Redo Theater Lobby/Escalator', 7965, 'Not started', '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 0),
  ('Make ticket booth room larger', 7965, 'Not started', '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 1),
  ('Improve Monkey Cage', 7965, 'Not started', '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 2),
  ('Add Raf''s Gourmet Food thingy', 7965, 'Not started', '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 3);