
-- Delete old subtasks that are no longer in the template for today's Apartment tasks
DELETE FROM subtasks 
WHERE "Parent Task ID" IN (9249, 9250, 9252)
AND "Task Name" IN ('Floor', 'Screw thingy, WD40', 'Laundry')
AND "Progress" != 'Completed';

-- Add new subtasks from the updated template for task 9249
INSERT INTO subtasks ("Task Name", "Parent Task ID", sort_order, user_id, "Progress")
VALUES 
  ('WD40', 9249, 6, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Clear out small items', 9249, 7, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Floor', 9249, 8, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom  - Sink', 9249, 9, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Toirlet', 9249, 10, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Tub', 9249, 11, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Stovetop', 9249, 12, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Around Sink', 9249, 13, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Floor', 9249, 14, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Floor - Get items', 9249, 15, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Floor - Swept', 9249, 16, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Shower!', 9249, 17, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started');

-- Add new subtasks for task 9250
INSERT INTO subtasks ("Task Name", "Parent Task ID", sort_order, user_id, "Progress")
VALUES 
  ('WD40', 9250, 6, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Clear out small items', 9250, 7, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Floor', 9250, 8, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom  - Sink', 9250, 9, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Toirlet', 9250, 10, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Tub', 9250, 11, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Stovetop', 9250, 12, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Around Sink', 9250, 13, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Floor', 9250, 14, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Floor - Get items', 9250, 15, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Floor - Swept', 9250, 16, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Shower!', 9250, 17, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started');

-- Add new subtasks for task 9252
INSERT INTO subtasks ("Task Name", "Parent Task ID", sort_order, user_id, "Progress")
VALUES 
  ('WD40', 9252, 6, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Clear out small items', 9252, 7, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Floor', 9252, 8, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom  - Sink', 9252, 9, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Toirlet', 9252, 10, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Bathroom - Tub', 9252, 11, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Stovetop', 9252, 12, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Around Sink', 9252, 13, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Kitchen - Floor', 9252, 14, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Floor - Get items', 9252, 15, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Floor - Swept', 9252, 16, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started'),
  ('Shower!', 9252, 17, '1523ecad-094b-4bfc-8ec0-fb382603ba8d', 'Not started');
