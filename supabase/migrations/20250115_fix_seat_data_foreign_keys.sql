-- =====================================================
-- Fix Seat Data Foreign Key Constraints
-- =====================================================
-- Remove or make optional foreign key constraints on seat_data
-- to allow migration of data that may have invalid references
-- =====================================================

-- Check if seat_data table exists and has foreign key constraints
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'seat_data') THEN
    
    -- Drop foreign key constraints if they exist
    -- This allows us to migrate data even if some references are invalid
    
    -- Drop master_course_id foreign key
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'seat_data' 
      AND constraint_name LIKE '%master_course_id%'
      AND constraint_type = 'FOREIGN KEY'
    ) THEN
      -- Get constraint name
      DECLARE
        fk_name TEXT;
      BEGIN
        SELECT constraint_name INTO fk_name
        FROM information_schema.table_constraints
        WHERE table_name = 'seat_data'
        AND constraint_name LIKE '%master_course_id%'
        AND constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE seat_data DROP CONSTRAINT IF EXISTS %I', fk_name);
          RAISE NOTICE 'Dropped foreign key constraint: %', fk_name;
        END IF;
      END;
    END IF;
    
    -- Drop master_college_id foreign key if exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'seat_data' 
      AND constraint_name LIKE '%master_college_id%'
      AND constraint_type = 'FOREIGN KEY'
    ) THEN
      DECLARE
        fk_name TEXT;
      BEGIN
        SELECT constraint_name INTO fk_name
        FROM information_schema.table_constraints
        WHERE table_name = 'seat_data'
        AND constraint_name LIKE '%master_college_id%'
        AND constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE seat_data DROP CONSTRAINT IF EXISTS %I', fk_name);
          RAISE NOTICE 'Dropped foreign key constraint: %', fk_name;
        END IF;
      END;
    END IF;
    
    -- Drop master_state_id foreign key if exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'seat_data' 
      AND constraint_name LIKE '%master_state_id%'
      AND constraint_type = 'FOREIGN KEY'
    ) THEN
      DECLARE
        fk_name TEXT;
      BEGIN
        SELECT constraint_name INTO fk_name
        FROM information_schema.table_constraints
        WHERE table_name = 'seat_data'
        AND constraint_name LIKE '%master_state_id%'
        AND constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE seat_data DROP CONSTRAINT IF EXISTS %I', fk_name);
          RAISE NOTICE 'Dropped foreign key constraint: %', fk_name;
        END IF;
      END;
    END IF;
    
    RAISE NOTICE 'Foreign key constraints removed from seat_data table';
  ELSE
    RAISE NOTICE 'seat_data table does not exist yet';
  END IF;
END $$;

