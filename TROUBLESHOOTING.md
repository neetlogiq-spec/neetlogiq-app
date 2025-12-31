# Troubleshooting: Empty Suggested Column

## Problem

Files are loaded but Suggested column shows no data.

## Root Cause

The files `standard_courses.txt` and `errors_and_corrections.xlsx` are loaded correctly (verified: 210 standards, 308 error mappings), but **data processing hasn't run yet**.

## Solution

Follow these steps in order:

### Step 1: Load Your Data Files

1. Click `File → Load File(s)...`
2. Select your Excel/CSV files with course names
3. Wait for the progress bar to complete

### Step 2: **CRITICAL** - Reprocess Data

1. Click the **"Reprocess Data"** button (top of Data tab)
2. Wait for processing to complete (progress bar will animate)
3. You should see:
   - Original column: raw course names from your files
   - Suggested column: matched standard course names
   - Score column: match confidence (0-100)
   - Status column: Auto-Matched / Possible Match / Did Not Match

### Step 3: Verify Results

- Check that Suggested column is now populated
- Green rows = Auto-Matched (high confidence)
- Yellow rows = Possible Match (review needed)
- Red rows = Did Not Match (manual correction needed)

## Why This Happens

The application workflow is:

1. **Load Files** → Stores raw data in database
2. **Reprocess Data** → Runs matching algorithm using standard_courses.txt
3. **View Results** → Displays matched data in tree

**You must click "Reprocess Data" after loading files!**

## Quick Test

To verify standard courses are loaded:

1. Go to `Manage → Standard Courses...`
2. You should see 210 courses listed
3. If empty, the files aren't in the correct location

## Alternative: Check Logs

Check `logs/` directory for error messages:

```bash
cat logs/course_standardizer.log
```

## Still Not Working?

If Suggested column is still empty after reprocessing:

1. Check that your loaded files have a column named "COURSE" or "COURSES" or similar
2. The processor looks for common column names (case-insensitive)
3. Check Dashboard → should show statistics if data was processed
