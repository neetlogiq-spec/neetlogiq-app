# 📝 Excel Editing Guide - Manual Data Correction

## 🎯 Why Edit Excel Files Instead of Parquet?
- ✅ **Source of Truth**: Excel files are your original data
- ✅ **Permanent Fix**: Changes persist through re-imports
- ✅ **Batch Processing**: Fix multiple variations at once
- ✅ **Version Control**: Keep backup copies

## 📁 Files to Edit

### **Seat Data Files** (Primary Sources):
```
/Users/kashyapanand/Desktop/EXPORT/seat data/
├── medical.xlsx     ← Edit COLLEGE_INSTITUTE column
├── dental.xlsx      ← Edit COLLEGE_INSTITUTE column  
└── dnb.xlsx         ← Edit COLLEGE_INSTITUTE column
```

### **Counselling Files**:
```
/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2024/
├── AIQ_PG_2024_R1.xlsx  ← Edit COLLEGE/INSTITUTE column
├── AIQ_PG_2024_R2.xlsx  ← Edit COLLEGE/INSTITUTE column
├── AIQ_PG_2024_R3.xlsx  ← Edit COLLEGE/INSTITUTE column
├── AIQ_PG_2024_R4.xlsx  ← Edit COLLEGE/INSTITUTE column
└── AIQ_PG_2024_R5.xlsx  ← Edit COLLEGE/INSTITUTE column
```

## 🔧 Step-by-Step Excel Editing

### **Step 1: Open Excel File**
```bash
# Navigate to your files
cd "/Users/kashyapanand/Desktop/EXPORT/seat data"
# Open medical.xlsx in Excel/LibreOffice
```

### **Step 2: Find & Replace (Ctrl+H / Cmd+H)**

#### **Top Priority Fix:**
```
Find:    SMS MEDICAL COLLEGE
Replace: SAWAI MAN SINGH MEDICAL COLLEGE
```

#### **Apply These 5 High-Impact Fixes:**
1. `SMS MEDICAL COLLEGE` → `SAWAI MAN SINGH MEDICAL COLLEGE`
2. `OSMANIA MEDICAL COLLGE` → `OSMANIA MEDICAL COLLEGE`  
3. `VARDHMAN MAHAVIR` → `VARDHAMAN MAHAVIR`
4. `GOVT MEDICAL COLLEGE` → `GOVERNMENT MEDICAL COLLEGE`
5. `BJGOVERNMENT` → `B.J. GOVERNMENT`

### **Step 3: Save & Verify**
- Save the Excel file
- Check a few rows manually to confirm changes
- Repeat for other files

## 📊 Expected Results After Editing
- **Before**: 72.1% match rate
- **After**: 85-90% match rate
- **Records Fixed**: ~3,000 records with top 5 fixes

## 🔄 Re-import After Editing
Once you've edited the Excel files, run:
```bash
npx tsx scripts/import-aiq-2024-enhanced.ts
```

This will re-process your corrected data and show improved matching rates.
