-- Add recording_type column to clients table
ALTER TABLE clients 
ADD COLUMN recording_type text NOT NULL DEFAULT 'allocation' 
CHECK (recording_type IN ('open', 'allocation'));

-- Add index for better query performance
CREATE INDEX idx_clients_recording_type ON clients(recording_type);