-- =====================================================
-- Fix Seat Data Table - Increase Column Lengths
-- =====================================================
-- Some columns in seat_data may have VARCHAR(50) limits
-- This migration increases them to TEXT to match SQLite
-- =====================================================

-- Check and alter seat_data table columns
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Check if seat_data table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seat_data') THEN
    
    -- Alter id column if it's VARCHAR(50)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'seat_data' 
      AND column_name = 'id' 
      AND data_type = 'character varying' 
      AND character_maximum_length = 50
    ) THEN
      ALTER TABLE seat_data ALTER COLUMN id TYPE TEXT;
      RAISE NOTICE 'Changed id column from VARCHAR(50) to TEXT';
    END IF;
    
    -- Alter college_name if it's VARCHAR(50)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'seat_data' 
      AND column_name = 'college_name' 
      AND data_type = 'character varying' 
      AND character_maximum_length = 50
    ) THEN
      ALTER TABLE seat_data ALTER COLUMN college_name TYPE TEXT;
      RAISE NOTICE 'Changed college_name column from VARCHAR(50) to TEXT';
    END IF;
    
    -- Alter course_name if it's VARCHAR(50)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'seat_data' 
      AND column_name = 'course_name' 
      AND data_type = 'character varying' 
      AND character_maximum_length = 50
    ) THEN
      ALTER TABLE seat_data ALTER COLUMN course_name TYPE TEXT;
      RAISE NOTICE 'Changed course_name column from VARCHAR(50) to TEXT';
    END IF;
    
    -- Check all VARCHAR columns and convert to TEXT
    FOR rec IN 
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'seat_data' 
      AND data_type = 'character varying'
      AND character_maximum_length IS NOT NULL
    LOOP
      EXECUTE format('ALTER TABLE seat_data ALTER COLUMN %I TYPE TEXT', rec.column_name);
      RAISE NOTICE 'Changed % column from VARCHAR to TEXT', rec.column_name;
    END LOOP;
    
    RAISE NOTICE 'Seat data table columns updated successfully!';
  ELSE
    RAISE NOTICE 'seat_data table does not exist - will be created during migration';
  END IF;
END $$;

