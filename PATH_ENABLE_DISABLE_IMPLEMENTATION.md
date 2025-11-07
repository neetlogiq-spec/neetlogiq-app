# Path Enable/Disable Implementation

## Overview

This document describes the implementation of config-based enable/disable for all matching paths to help identify defective pathways.

---

## Current Path Status

### ✅ **Fix Applied to All Paths**

The `normalized_name` fix is applied to all paths that perform name matching:

1. ✅ **`pass3_college_name_matching()`** (line 12054)
   - Used by: `match_regular_course()`, `match_overlapping_diploma_course()`, `match_medical_only_diploma_course()`
   - Fix: Lines 12054-12061

2. ✅ **`match_college_ultra_optimized()`** (line 7758)
   - Used by: `match_college_smart_hybrid()` when `use_smart_hybrid = False`
   - Fix: Lines 7758-7761

3. ✅ **`match_college_ai_enhanced()`** (line 19752)
   - Used by: `match_college_smart_hybrid()` as AI fallback
   - Fix: Lines 19752-19755

---

## Implementation Plan

### Step 1: Add Config Section

Add to `config.yaml`:
```yaml
# Matching Path Configuration
matching_paths:
  # Enable/disable specific matching paths for debugging
  enable_smart_hybrid: true          # match_college_smart_hybrid()
  enable_enhanced: true             # match_college_enhanced()
  enable_ultra_optimized: true      # match_college_ultra_optimized()
  enable_ai_enhanced: true           # match_college_ai_enhanced()
  enable_regular_course: true        # match_regular_course()
  enable_overlapping_diploma: true   # match_overlapping_diploma_course()
  enable_medical_only_diploma: true  # match_medical_only_diploma_course()
```

### Step 2: Update Matching Functions

Add path enable/disable checks at the beginning of each matching function:

1. **`match_college_smart_hybrid()`**: Check `enable_smart_hybrid`
2. **`match_college_enhanced()`**: Check `enable_enhanced`
3. **`match_college_ultra_optimized()`**: Check `enable_ultra_optimized`
4. **`match_college_ai_enhanced()`**: Check `enable_ai_enhanced`
5. **`match_regular_course()`**: Check `enable_regular_course`
6. **`match_overlapping_diploma_course()`**: Check `enable_overlapping_diploma`
7. **`match_medical_only_diploma_course()`**: Check `enable_medical_only_diploma`

### Step 3: Fallback Logic

When a path is disabled:
- Log a warning with the path name
- Fall back to the next available path
- If all paths are disabled, return `None, 0.0, 'path_disabled'`

---

## Benefits

1. **Debugging**: Easily identify which path is causing issues
2. **Testing**: Test individual paths in isolation
3. **Performance**: Disable slow paths during development
4. **Flexibility**: Enable/disable paths based on use case

---

## Usage Example

### Disable AI Path to Test Fast Path Only
```yaml
matching_paths:
  enable_smart_hybrid: true
  enable_ai_enhanced: false  # Disable AI fallback
```

### Test Only Regular Course Matching
```yaml
matching_paths:
  enable_smart_hybrid: false
  enable_enhanced: true
  enable_regular_course: true
  enable_overlapping_diploma: false
  enable_medical_only_diploma: false
```

### Test Only Ultra Optimized Path
```yaml
matching_paths:
  enable_smart_hybrid: false
  enable_ultra_optimized: true
```

---

## Implementation

See the code changes below for the actual implementation.

---

**End of Implementation Plan**


