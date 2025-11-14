-- ============================================================================
-- Test Composite Key Fix for Duplicate College Names
-- ============================================================================
-- This test verifies that the composite_college_key fix resolves false matches
-- for colleges with identical names but different addresses in the same state
-- ============================================================================

.mode column
.headers on
.width 10 30 60 100

-- Test 1: Verify all 8 DISTRICT HOSPITAL entries in Karnataka are visible
SELECT
    '=== TEST 1: All 8 DISTRICT HOSPITAL entries should be visible ===' as test_header;

SELECT
    id,
    normalized_name,
    normalized_address,
    composite_college_key
FROM colleges
WHERE normalized_state = 'KARNATAKA'
  AND normalized_name = 'DISTRICT HOSPITAL'
ORDER BY composite_college_key;

-- Expected: 8 rows (DNB0352-DNB0359)

-- Test 2: Verify OLD method (normalized_name = ...) returns only 1 row
SELECT
    '' as blank,
    '=== TEST 2: OLD method using normalized_name (BROKEN) ===' as test_header;

SELECT
    id,
    normalized_name,
    normalized_address
FROM colleges
WHERE normalized_state = 'KARNATAKA'
  AND normalized_name = 'DISTRICT HOSPITAL'
LIMIT 1;

-- Expected: Only 1 row (arbitrary match - BROKEN!)

-- Test 3: Verify NEW method (composite_college_key LIKE ...) returns all 8
SELECT
    '' as blank,
    '=== TEST 3: NEW method using composite_college_key LIKE (FIXED) ===' as test_header;

SELECT
    id,
    normalized_name,
    normalized_address,
    composite_college_key
FROM colleges
WHERE normalized_state = 'KARNATAKA'
  AND composite_college_key LIKE 'DISTRICT HOSPITAL,%'
ORDER BY composite_college_key;

-- Expected: 8 rows (DNB0352-DNB0359) - ALL distinct!

-- Test 4: Simulate address disambiguation - find Vijayapura campus
SELECT
    '' as blank,
    '=== TEST 4: Address disambiguation for VIJAYAPURA campus ===' as test_header;

SELECT
    id,
    normalized_name,
    normalized_address,
    composite_college_key
FROM colleges
WHERE normalized_state = 'KARNATAKA'
  AND composite_college_key LIKE 'DISTRICT HOSPITAL,%'
  AND INSTR(UPPER(COALESCE(address, '')), UPPER('VIJAYAPURA')) > 0;

-- Expected: Only DNB0352 (NEXT TO SAINIK SCHOOL SECOND GATE, ATHANI ROAD, VIJAYAPURA)

-- Test 5: Simulate address disambiguation - find Ballari campus
SELECT
    '' as blank,
    '=== TEST 5: Address disambiguation for BALLARI campus ===' as test_header;

SELECT
    id,
    normalized_name,
    normalized_address,
    composite_college_key
FROM colleges
WHERE normalized_state = 'KARNATAKA'
  AND composite_college_key LIKE 'DISTRICT HOSPITAL,%'
  AND INSTR(UPPER(COALESCE(address, '')), UPPER('BALLARI')) > 0;

-- Expected: Only DNB0356 (NEAR SANGAM CIRCLE, DR RAJ KUMAR ROAD, BALLARI)

-- Test 6: Check other states with duplicate college names
SELECT
    '' as blank,
    '=== TEST 6: Other duplicate college names ===' as test_header;

SELECT
    normalized_state,
    normalized_name,
    COUNT(*) as duplicate_count
FROM colleges
GROUP BY normalized_state, normalized_name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, normalized_state, normalized_name
LIMIT 20;

-- Expected: List of states with duplicate college names
-- Example: BIHAR - SADAR HOSPITAL (7 duplicates)
--          ANDHRA PRADESH - AREA HOSPITAL (6 duplicates)
--          etc.

-- Test 7: Verify composite_college_key is unique (or at least more unique than normalized_name)
SELECT
    '' as blank,
    '=== TEST 7: Composite key uniqueness ===' as test_header;

SELECT
    'Total colleges' as metric,
    COUNT(*) as count
FROM colleges
UNION ALL
SELECT
    'Unique normalized_name',
    COUNT(DISTINCT normalized_name)
FROM colleges
UNION ALL
SELECT
    'Unique composite_college_key',
    COUNT(DISTINCT composite_college_key)
FROM colleges;

-- Expected:
-- Total colleges: ~2,443
-- Unique normalized_name: ~2,322 (121 duplicates)
-- Unique composite_college_key: ~2,443 (nearly all unique!)
