-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a simple function to keep the database active
CREATE OR REPLACE FUNCTION keep_database_active()
RETURNS void AS $$
BEGIN
  -- Perform a lightweight query to maintain activity
  PERFORM COUNT(*) FROM profiles LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job to run daily at midnight UTC
SELECT cron.schedule(
  'keep-database-active-daily',  -- job name
  '0 0 * * *',                    -- cron expression: daily at midnight UTC
  'SELECT keep_database_active();' -- SQL to execute
);