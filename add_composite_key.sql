-- ============================================================================
-- Add Composite College Key to Fix Duplicate College Name False Matches
-- ============================================================================
-- Problem: Multiple colleges with identical names in same state (e.g., 8 "DISTRICT HOSPITAL" in Karnataka)
-- Solution: Create composite key = normalized_name + ', ' + normalized_address
--           This makes each college truly distinct for matching
-- ============================================================================

-- Step 1: Add normalized_address column to all 3 college tables
ALTER TABLE medical_colleges ADD COLUMN normalized_address TEXT;
ALTER TABLE dental_colleges ADD COLUMN normalized_address TEXT;
ALTER TABLE dnb_colleges ADD COLUMN normalized_address TEXT;

-- Step 2: Populate normalized_address (using same normalization as names)
-- Normalize addresses: UPPERCASE, remove extra spaces, remove special chars
UPDATE medical_colleges
SET normalized_address = UPPER(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(address, '  ', ' '), ',', ''), '.', ''), '  ', ' ')))
WHERE address IS NOT NULL;

UPDATE dental_colleges
SET normalized_address = UPPER(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(address, '  ', ' '), ',', ''), '.', ''), '  ', ' ')))
WHERE address IS NOT NULL;

UPDATE dnb_colleges
SET normalized_address = UPPER(TRIM(REPLACE(REPLACE(REPLACE(REPLACE(address, '  ', ' '), ',', ''), '.', ''), '  ', ' ')))
WHERE address IS NOT NULL;

-- Step 3: Add composite_college_key column to all 3 college tables
ALTER TABLE medical_colleges ADD COLUMN composite_college_key TEXT;
ALTER TABLE dental_colleges ADD COLUMN composite_college_key TEXT;
ALTER TABLE dnb_colleges ADD COLUMN composite_college_key TEXT;

-- Step 4: Populate composite_college_key = normalized_name + ', ' + normalized_address
UPDATE medical_colleges
SET composite_college_key = normalized_name || ', ' || COALESCE(normalized_address, '')
WHERE normalized_name IS NOT NULL;

UPDATE dental_colleges
SET composite_college_key = normalized_name || ', ' || COALESCE(normalized_address, '')
WHERE normalized_name IS NOT NULL;

UPDATE dnb_colleges
SET composite_college_key = normalized_name || ', ' || COALESCE(normalized_address, '')
WHERE normalized_name IS NOT NULL;

-- Step 5: Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_medical_composite_key ON medical_colleges(composite_college_key);
CREATE INDEX IF NOT EXISTS idx_dental_composite_key ON dental_colleges(composite_college_key);
CREATE INDEX IF NOT EXISTS idx_dnb_composite_key ON dnb_colleges(composite_college_key);

-- Step 6: Update colleges VIEW to include new columns
DROP VIEW IF EXISTS colleges;
CREATE VIEW colleges AS
    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        normalized_address,
        composite_college_key,
        'MEDICAL' as source_table
    FROM medical_colleges

    UNION ALL

    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        normalized_address,
        composite_college_key,
        'DENTAL' as source_table
    FROM dental_colleges

    UNION ALL

    SELECT
        id,
        name,
        state,
        address,
        college_type,
        normalized_name,
        normalized_state,
        normalized_address,
        composite_college_key,
        'DNB' as source_table
    FROM dnb_colleges;

-- Verification Query: Check DISTRICT HOSPITAL in Karnataka
-- Before: Would show as 1 entry (or pick first)
-- After: Shows all 8 as distinct entries
SELECT id, normalized_name, normalized_address, composite_college_key
FROM colleges
WHERE normalized_state = 'KARNATAKA'
  AND normalized_name = 'DISTRICT HOSPITAL'
ORDER BY composite_college_key;

-- Expected result: 8 rows with distinct composite keys
