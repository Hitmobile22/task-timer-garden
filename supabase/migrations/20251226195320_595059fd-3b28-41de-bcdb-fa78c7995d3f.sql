-- Add project_id column to synced_calendar_events table for tracking project sync
ALTER TABLE synced_calendar_events 
ADD COLUMN project_id BIGINT REFERENCES "Projects"(id) ON DELETE CASCADE;