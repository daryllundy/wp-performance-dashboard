-- Performance Schema Setup for Demo Environment
-- This script configures Performance Schema for optimal monitoring

-- Enable all statement event consumers
UPDATE performance_schema.setup_consumers 
SET ENABLED = 'YES' 
WHERE NAME IN (
    'events_statements_current',
    'events_statements_history',
    'events_statements_history_long'
);

-- Enable all stage event consumers
UPDATE performance_schema.setup_consumers 
SET ENABLED = 'YES' 
WHERE NAME IN (
    'events_stages_current',
    'events_stages_history',
    'events_stages_history_long'
);

-- Enable all wait event consumers
UPDATE performance_schema.setup_consumers 
SET ENABLED = 'YES' 
WHERE NAME IN (
    'events_waits_current',
    'events_waits_history',
    'events_waits_history_long'
);

-- Enable global and thread instrumentation
UPDATE performance_schema.setup_consumers 
SET ENABLED = 'YES' 
WHERE NAME IN (
    'global_instrumentation',
    'thread_instrumentation',
    'statements_digest'
);

-- Enable specific instruments for comprehensive monitoring
UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE 'statement/sql/%';

UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE 'stage/sql/%';

UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE 'wait/io/file/%';

UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE 'wait/io/table/%';

UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE 'wait/lock/%';

-- Enable memory instrumentation for memory usage tracking
UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES' 
WHERE NAME LIKE 'memory/%';

-- Enable connection and thread instrumentation
UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE 'thread/%';

-- Configure statement digest parameters
SET GLOBAL performance_schema_max_digest_length = 4096;
SET GLOBAL performance_schema_max_sql_text_length = 4096;

-- Truncate existing performance schema tables to start fresh
TRUNCATE TABLE performance_schema.events_statements_history_long;
TRUNCATE TABLE performance_schema.events_stages_history_long;
TRUNCATE TABLE performance_schema.events_waits_history_long;

-- Show current configuration status
SELECT 
    NAME as consumer_name,
    ENABLED 
FROM performance_schema.setup_consumers 
WHERE ENABLED = 'YES'
ORDER BY NAME;

SELECT 
    NAME as instrument_name,
    ENABLED,
    TIMED
FROM performance_schema.setup_instruments 
WHERE ENABLED = 'YES' 
AND NAME LIKE 'statement/%'
ORDER BY NAME
LIMIT 10;
