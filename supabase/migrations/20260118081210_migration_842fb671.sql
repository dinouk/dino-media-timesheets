-- Drop the existing check constraint
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_recording_type_check;

-- Add new check constraint with correct values
ALTER TABLE clients ADD CONSTRAINT clients_recording_type_check 
CHECK (recording_type IN ('open', 'allocation'));