# Legacy Scripts - DEPRECATED

⚠️ **These scripts are DEPRECATED and should not be used for new imports.**

## Use `standard-importer.py` Instead

All functionality from these legacy scripts has been consolidated into the unified `standard-importer.py` script located in the parent directory.

### Migration Guide

#### Old Scripts → New Standard Importer

| **Legacy Script** | **New Command** |
|------------------|------------------|
| `reimport_counselling_enhanced.py` | `python3 ../standard-importer.py --type counselling` |
| `import_counselling_data.py` | `python3 ../standard-importer.py --type counselling` |
| `kea2024_enhanced_matcher.py` | `python3 ../standard-importer.py --type counselling` |
| `enhanced_college_course_matcher.py` | `python3 ../standard-importer.py --type college` |
| `extract_unmatched_records.py` | Reports generated automatically by standard-importer |
| `run_full_matching.py` | `python3 ../standard-importer.py --auto-detect` |

#### Examples

```bash
# For counselling data (KEA, AIQ, etc.)
python3 ../standard-importer.py --file /path/to/KEA2024.xlsx --type counselling

# For college/seat data
python3 ../standard-importer.py --file /path/to/seat_data.xlsx --type college

# Auto-detect data type
python3 ../standard-importer.py --file /path/to/data.xlsx --auto-detect

# Show help
python3 ../standard-importer.py --help
```

## Why These Scripts Are Deprecated

1. **Duplication**: Multiple scripts doing similar tasks
2. **Inconsistency**: Different output formats and processing logic
3. **Maintenance**: Hard to maintain multiple codebases
4. **User Confusion**: Users had to choose between different scripts

## What `standard-importer.py` Provides

✅ **Unified Interface**: Single script for all data types  
✅ **Auto-Detection**: Automatically detects counselling vs college data  
✅ **Same Algorithm**: Uses the proven enhanced matching logic  
✅ **Better Reports**: Comprehensive reporting with audit trails  
✅ **Consistent Output**: Standardized JSON/CSV output format  
✅ **Master Data Integration**: Full support for aliases, mappings, and rules  
✅ **Command Line Interface**: Professional CLI with help and examples  

## Legacy Script Status

- **Moved to `legacy_scripts/`**: For reference only
- **No longer maintained**: Will not receive updates or bug fixes
- **May be removed**: In future cleanup operations

## Need Help?

If you have a specific use case that the standard importer doesn't handle, please:

1. Try the standard importer first
2. Check the help: `python3 ../standard-importer.py --help`
3. Review the examples above
4. If you still need the legacy functionality, please document your specific requirements

---

**Last Updated**: 2025-09-26  
**Deprecation Date**: 2025-09-26  
**Replacement**: `standard-importer.py`