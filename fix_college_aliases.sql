-- Add comprehensive college name aliases to handle variations
-- This handles "AND" keyword variations that cause mismatches

-- Clear existing aliases first to avoid duplicates
DELETE FROM college_aliases WHERE original_name LIKE '%GOVERNMENT DENTAL%' OR original_name LIKE '%BHARATI%' OR original_name LIKE '%KVG%' OR original_name LIKE '%DR D Y PATIL%' OR original_name LIKE '%FACULTY OF DENTAL%';

-- GOVERNMENT DENTAL COLLEGE AND HOSPITAL → GOVERNMENT DENTAL COLLEGE HOSPITAL
INSERT INTO college_aliases (original_name, alias_name, master_college_id, state_normalized, address_normalized)
SELECT DISTINCT
    'GOVERNMENT DENTAL COLLEGE AND HOSPITAL',
    'GOVERNMENT DENTAL COLLEGE HOSPITAL',
    c.id,
    s.normalized_name,
    UPPER(c.address)
FROM colleges c
JOIN state_college_link scl ON c.id = scl.college_id
JOIN states s ON s.id = scl.state_id
WHERE c.normalized_name = 'GOVERNMENT DENTAL COLLEGE HOSPITAL'
AND c.source_table = 'DENTAL';

-- BHARATI VIDYAPEETH DENTAL COLLEGE AND HOSPITAL → BHARATI VIDYAPEETH DENTAL COLLEGE HOSPITAL
INSERT INTO college_aliases (original_name, alias_name, master_college_id, state_normalized, address_normalized)
SELECT DISTINCT
    'BHARATI VIDYAPEETH DENTAL COLLEGE AND HOSPITAL',
    'BHARATI VIDYAPEETH DENTAL COLLEGE HOSPITAL',
    c.id,
    s.normalized_name,
    UPPER(c.address)
FROM colleges c
JOIN state_college_link scl ON c.id = scl.college_id
JOIN states s ON s.id = scl.state_id
WHERE c.normalized_name = 'BHARATI VIDYAPEETH DENTAL COLLEGE HOSPITAL'
AND c.source_table = 'DENTAL';

-- K V G DENTAL COLLEGE AND HOSPITAL
INSERT INTO college_aliases (original_name, alias_name, master_college_id, state_normalized, address_normalized)
SELECT DISTINCT
    'K V G DENTAL COLLEGE AND HOSPITAL',
    c.normalized_name,
    c.id,
    s.normalized_name,
    UPPER(c.address)
FROM colleges c
JOIN state_college_link scl ON c.id = scl.college_id
JOIN states s ON s.id = scl.state_id
WHERE c.name LIKE '%K V G%DENTAL%'
AND c.source_table = 'DENTAL';

-- DR D Y PATIL variations
INSERT INTO college_aliases (original_name, alias_name, master_college_id, state_normalized, address_normalized)
SELECT DISTINCT
    'DR D Y PATIL DENTAL COLLEGE AND HOSPITAL',
    c.normalized_name,
    c.id,
    s.normalized_name,
    UPPER(c.address)
FROM colleges c
JOIN state_college_link scl ON c.id = scl.college_id
JOIN states s ON s.id = scl.state_id
WHERE c.name LIKE '%DR D Y PATIL%DENTAL%'
AND c.source_table = 'DENTAL';

-- Faculty of Dental Sciences variations
INSERT INTO college_aliases (original_name, alias_name, master_college_id, state_normalized, address_normalized)
SELECT DISTINCT
    'FACULTY OF DENTAL SCIENCES',
    c.normalized_name,
    c.id,
    s.normalized_name,
    UPPER(c.address)
FROM colleges c
JOIN state_college_link scl ON c.id = scl.college_id
JOIN states s ON s.id = scl.state_id
WHERE c.name LIKE '%FACULTY OF DENTAL%' AND c.source_table = 'DENTAL';

-- Verify insertions
SELECT 'Aliases created successfully' as status;
SELECT COUNT(*) as 'Total aliases' FROM college_aliases WHERE original_name LIKE '%DENTAL%';
