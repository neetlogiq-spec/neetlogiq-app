# UI Display Examples with Seat Ranks

## Overview
How to display individual seat ranks from the `all_ranks` array in your UI.

## Example Data Structure

```json
{
  "college_name": "ACSR Government Medical College",
  "course_name": "MD IN GENERAL MEDICINE",
  "year": 2024,
  "round": "AIQ_R2",
  "quota": "ALL INDIA",
  "category": "OPEN",
  "opening_rank": 3460,
  "closing_rank": 4000,
  "seat_count": 4,
  "all_ranks": [3460, 3764, 3897, 4000]
}
```

## Display Options

### Option 1: Compact View (Summary)
```
MD IN GENERAL MEDICINE | ALL INDIA | OPEN
Rank Range: 3460 - 4000 (4 seats)
```

### Option 2: Detailed View (All Ranks)
```
MD IN GENERAL MEDICINE | ALL INDIA | OPEN
Ranks: 3460, 3764, 3897, 4000
(4 seats available)
```

### Option 3: Expanded View (Individual Seat List)
```
MD IN GENERAL MEDICINE | ALL INDIA | OPEN
┌─────────────────────────────┐
│ Seat 1: Rank 3460          │
│ Seat 2: Rank 3764          │
│ Seat 3: Rank 3897          │
│ Seat 4: Rank 4000          │
└─────────────────────────────┘
Total: 4 seats
Range: 3460 - 4000
```

### Option 4: Visual Comparison
```
MD IN GENERAL MEDICINE | ALL INDIA
├── OPEN:     3460, 3764, 3897, 4000 (4 seats)
├── OBC:      4124, 4402 (2 seats)
├── SC:       14753 (1 seat)
└── ST:       28289 (1 seat)
```

## React Component Example

```tsx
interface CutoffDisplayProps {
  record: {
    college_name: string;
    course_name: string;
    quota: string;
    category: string;
    opening_rank: number;
    closing_rank: number;
    seat_count: number;
    all_ranks?: number[];  // Optional - only available in detail view
  };
  showIndividualRanks?: boolean;  // Toggle for detail view
}

function CutoffDisplay({ record, showIndividualRanks = false }: CutoffDisplayProps) {
  return (
    <div className="cutoff-record">
      <h3>{record.course_name}</h3>
      <div className="quota-category">
        {record.quota} | {record.category}
      </div>
      
      {/* Always show summary */}
      <div className="summary">
        <span>Rank Range: {record.opening_rank} - {record.closing_rank}</span>
        <span className="seat-count">({record.seat_count} seats)</span>
      </div>
      
      {/* Show individual ranks when available and requested */}
      {showIndividualRanks && record.all_ranks && (
        <div className="individual-ranks">
          <h4>Individual Seat Ranks:</h4>
          <ul>
            {record.all_ranks.map((rank, index) => (
              <li key={index}>
                Seat {index + 1}: Rank {rank}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Usage:
// List view - don't fetch all_ranks (fast)
<CutoffDisplay record={cutoff} showIndividualRanks={false} />

// Detail view - fetch all_ranks (shows individual ranks)
<CutoffDisplay record={cutoffDetail} showIndividualRanks={true} />
```

## Query Strategy

### List View (Fast - No Array)
```typescript
// Don't select all_ranks - Parquet skips reading it
const listQuery = `
  SELECT 
    college_name, course_name, quota, category,
    opening_rank, closing_rank, seat_count
  FROM read_parquet('source=SRC001_level=LVL002_year=2024.parquet')
  WHERE closing_rank <= $1
  ORDER BY closing_rank
  LIMIT 100
`;
// Fast ⚡ - no array overhead
```

### Detail View (Includes Array)
```typescript
// Select all_ranks - Parquet reads it only for this record
const detailQuery = `
  SELECT 
    college_name, course_name, quota, category,
    opening_rank, closing_rank, seat_count,
    all_ranks  -- ← Include array for detail view
  FROM read_parquet('source=SRC001_level=LVL002_year=2024.parquet')
  WHERE college_id = $1
    AND course_id = $2
    AND round = $3
    AND quota = $4
    AND category = $5
`;
// Returns: all_ranks = [3460, 3764, 3897, 4000]
// Can display individual ranks in UI
```

## Performance Notes

1. **List View**: Parquet column projection automatically skips `all_ranks` if not selected → **Fast** ⚡
2. **Detail View**: Only reads `all_ranks` for specific record(s) → **Efficient** ✅
3. **Array Size**: Typically 1-10 ranks per quota-category → **Small overhead**
4. **Storage**: Array compression in Parquet → **Space efficient**

## API Response Examples

### List Endpoint (Fast)
```json
{
  "data": [
    {
      "college_name": "ACSR Government Medical College",
      "course_name": "MD IN GENERAL MEDICINE",
      "quota": "ALL INDIA",
      "category": "OPEN",
      "opening_rank": 3460,
      "closing_rank": 4000,
      "seat_count": 4
      // all_ranks NOT included (faster response)
    }
  ]
}
```

### Detail Endpoint (Includes Ranks)
```json
{
  "data": {
    "college_name": "ACSR Government Medical College",
    "course_name": "MD IN GENERAL MEDICINE",
    "quota": "ALL INDIA",
    "category": "OPEN",
    "opening_rank": 3460,
    "closing_rank": 4000,
    "seat_count": 4,
    "all_ranks": [3460, 3764, 3897, 4000]  // ← Available for display
  }
}
```

## Benefits

✅ **Fast List Views** - Don't read arrays when not needed  
✅ **Rich Detail Views** - Show individual ranks when requested  
✅ **Single Source** - Same data for both views  
✅ **Flexible** - Choose what to display based on user needs  
✅ **Efficient** - Parquet column projection handles optimization automatically

