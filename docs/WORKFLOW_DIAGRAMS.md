# Workflow Diagrams: Match and Link SQLite Seat Data System

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Input Layer"
        A1[Raw Seat Data<br/>CSV/Excel/DB]
        A2[Raw Counselling Data<br/>CSV/Excel/DB]
    end
    
    subgraph "Preprocessing Layer"
        B1[Text Normalization<br/>normalize_text]
        B2[State Normalization<br/>normalize_state]
        B3[Address Normalization<br/>normalize_address]
        B4[Course Type Detection<br/>detect_course_type]
    end
    
    subgraph "Matching Engine"
        C1[State Filtering<br/>state_college_link]
        C2[Stream Filtering<br/>medical/dental/dnb]
        C3[Course Evidence Filtering<br/>state_course_college_link_text]
        C4[College Name Matching<br/>exact/primary/prefix/fuzzy]
        C5[Address Disambiguation<br/>keyword overlap]
    end
    
    subgraph "Validation Layer"
        D1[State-College Validation<br/>validate_state_college_link]
        D2[Course-Stream Validation<br/>validate_college_course_stream_match]
        D3[Address Validation<br/>keyword matching]
    end
    
    subgraph "Database Layer"
        E1[(Master Database<br/>master_data.db)]
        E2[(Seat Database<br/>seat_data.db)]
    end
    
    subgraph "Cache Layer"
        F1[Normalize Cache<br/>10K entries]
        F2[Pool Cache<br/>1K entries]
        F3[Seat Link Cache<br/>1K entries]
        F4[Course ID Cache<br/>500 entries]
        F5[State ID Cache<br/>100 entries]
    end
    
    subgraph "Output Layer"
        G1[Linked Results<br/>master_college_id<br/>master_course_id]
        G2[Match Statistics<br/>scores/methods]
        G3[Validation Reports<br/>failures/warnings]
    end
    
    A1 --> B1
    A2 --> B1
    B1 --> B2
    B1 --> B3
    B1 --> B4
    
    B2 --> C1
    B4 --> C2
    C1 --> C2
    C2 --> C3
    C3 --> C4
    C4 --> C5
    
    C5 --> D1
    D1 --> D2
    D2 --> D3
    
    C1 -.-> E1
    C3 -.-> E2
    D1 -.-> E1
    
    C1 -.-> F2
    C3 -.-> F3
    C4 -.-> F1
    D1 -.-> F5
    
    D3 --> G1
    G1 --> G2
    G2 --> G3
```

## Matching Workflow Diagram

```mermaid
flowchart TD
    Start([Record Input<br/>college_name, state, course_name])
    
    Norm[Normalize Fields<br/>normalize_text/state/address]
    
    CourseID[Resolve Course ID<br/>get_course_id_by_name<br/>CACHED]
    
    StateFilter[State-Based Filtering<br/>get_college_pool_ultra_optimized<br/>SQL: state_college_link JOIN<br/>Result: 10-50 candidates]
    
    CourseFilter{Course Evidence<br/>Available?}
    
    Strict{Validation<br/>Strictness}
    
    NarrowStrict[Narrow: Only Evidence Colleges<br/>Result: 1-5 candidates]
    
    ReorderModerate[Reorder: Evidence First<br/>Result: 10-50 candidates]
    
    KeepAllLenient[Keep All Candidates<br/>Result: 10-50 candidates]
    
    ExactMatch{Exact Match?<br/>normalized_college == candidate.name}
    
    PrimaryMatch{Primary Match?<br/>extract_primary_name}
    
    PrefixMatch{Prefix Match?<br/>len >= 10}
    
    FuzzyMatch{Fuzzy Match?<br/>pool <= 100}
    
    AddressDisambig[Address Disambiguation<br/>keyword overlap boost]
    
    Validate[State-College Validation<br/>validate_state_college_link<br/>CACHED]
    
    ReturnMatch([Return Match<br/>college, score, method])
    
    ReturnNoMatch([Return No Match<br/>None, 0.0, 'no_match'])
    
    Start --> Norm
    Norm --> CourseID
    CourseID --> StateFilter
    StateFilter --> CourseFilter
    
    CourseFilter -->|Yes| Strict
    CourseFilter -->|No| ExactMatch
    
    Strict -->|strict| NarrowStrict
    Strict -->|moderate| ReorderModerate
    Strict -->|lenient| KeepAllLenient
    
    NarrowStrict --> ExactMatch
    ReorderModerate --> ExactMatch
    KeepAllLenient --> ExactMatch
    
    ExactMatch -->|Yes| Validate
    ExactMatch -->|No| PrimaryMatch
    
    PrimaryMatch -->|Yes| Validate
    PrimaryMatch -->|No| PrefixMatch
    
    PrefixMatch -->|Yes| AddressDisambig
    PrefixMatch -->|No| FuzzyMatch
    
    AddressDisambig --> Validate
    
    FuzzyMatch -->|Yes| Validate
    FuzzyMatch -->|No| ReturnNoMatch
    
    Validate -->|Valid| ReturnMatch
    Validate -->|Invalid| ReturnNoMatch
```

## Database Link Table Architecture

```mermaid
erDiagram
    STATES ||--o{ STATE_COLLEGE_LINK : "has"
    COLLEGES ||--o{ STATE_COLLEGE_LINK : "has"
    STATE_COLLEGE_LINK {
        string state_id PK
        string college_id PK
    }
    
    SEAT_DATA ||--o{ COLLEGE_COURSE_LINK : "updates"
    COLLEGE_COURSE_LINK {
        string college_id PK
        string course_id PK
        int occurrences
        datetime last_seen_ts
    }
    
    SEAT_DATA ||--o{ STATE_COURSE_COLLEGE_LINK_TEXT : "updates"
    STATE_COURSE_COLLEGE_LINK_TEXT {
        string normalized_state PK
        string course_id PK
        string college_id PK
        string seat_address_normalized
        int occurrences
        datetime last_seen_ts
    }
    
    STATES ||--o{ STATE_COURSE_COLLEGE_LINK : "has"
    COURSES ||--o{ STATE_COURSE_COLLEGE_LINK : "has"
    COLLEGES ||--o{ STATE_COURSE_COLLEGE_LINK : "has"
    STATE_COURSE_COLLEGE_LINK_TEXT ||--|| STATE_COURSE_COLLEGE_LINK : "syncs to"
    STATE_COURSE_COLLEGE_LINK {
        string state_id PK
        string course_id PK
        string college_id PK
        string stream
        string master_address
        string seat_address_normalized
        int occurrences
        datetime last_seen_ts
    }
    
    STATE_MAPPINGS ||--o{ STATES : "maps to"
    STATE_MAPPINGS {
        string id PK
        string raw_state UK
        string normalized_state
        boolean is_verified
    }
```

## Cache Flow Diagram

```mermaid
graph LR
    subgraph "Cache Hierarchy"
        A[Input Request]
        
        B[Normalize Cache<br/>10K entries<br/>Hit: 80-90%]
        
        C[Pool Cache<br/>1K entries<br/>Hit: 60-70%]
        
        D[Seat Link Cache<br/>1K entries<br/>Hit: 50-60%]
        
        E[Course ID Cache<br/>500 entries<br/>Hit: 70-80%]
        
        F[State ID Cache<br/>100 entries<br/>Hit: 90-95%]
        
        G[Database Query]
        
        H[Cache Statistics<br/>Hits/Misses/Rates]
    end
    
    A -->|text| B
    A -->|state, course_type| C
    A -->|state, course_id| D
    A -->|course_name| E
    A -->|state| F
    
    B -->|Miss| G
    C -->|Miss| G
    D -->|Miss| G
    E -->|Miss| G
    F -->|Miss| G
    
    B -->|Hit| B
    C -->|Hit| C
    D -->|Hit| D
    E -->|Hit| E
    F -->|Hit| F
    
    B --> H
    C --> H
    D --> H
    E --> H
    F --> H
```

## Batch Processing Flow

```mermaid
sequenceDiagram
    participant Main as Main Process
    participant Queue as Task Queue
    participant Worker1 as Worker 1
    participant Worker2 as Worker 2
    participant WorkerN as Worker N
    participant DB as Database
    participant Cache as Cache Layer
    
    Main->>Queue: Submit Batch Tasks
    Queue->>Worker1: Assign Batch 1 (1-100)
    Queue->>Worker2: Assign Batch 2 (101-200)
    Queue->>WorkerN: Assign Batch N (...)
    
    par Worker 1 Processing
        Worker1->>Cache: Check Cache
        Cache-->>Worker1: Cache Hit/Miss
        Worker1->>DB: Query if Cache Miss
        DB-->>Worker1: Return Data
        Worker1->>Worker1: Match & Validate
        Worker1->>DB: Write Results
    and Worker 2 Processing
        Worker2->>Cache: Check Cache
        Cache-->>Worker2: Cache Hit/Miss
        Worker2->>DB: Query if Cache Miss
        DB-->>Worker2: Return Data
        Worker2->>Worker2: Match & Validate
        Worker2->>DB: Write Results
    and Worker N Processing
        WorkerN->>Cache: Check Cache
        Cache-->>WorkerN: Cache Hit/Miss
        WorkerN->>DB: Query if Cache Miss
        DB-->>WorkerN: Return Data
        WorkerN->>WorkerN: Match & Validate
        WorkerN->>DB: Write Results
    end
    
    Worker1->>Main: Results 1-100
    Worker2->>Main: Results 101-200
    WorkerN->>Main: Results ...
    
    Main->>Main: Aggregate Results
    Main->>Main: Generate Statistics
```

## Link Table Auto-Update Flow

```mermaid
sequenceDiagram
    participant SD as seat_data Table
    participant Trigger1 as INSERT Trigger
    participant Trigger2 as UPDATE Trigger
    participant CCL as college_course_link
    participant SCCLT as state_course_college_link_text
    participant Sync as Sync Function
    participant SCCL as state_course_college_link (Master)
    
    SD->>Trigger1: INSERT Record<br/>master_college_id<br/>master_course_id<br/>normalized_state
    Trigger1->>CCL: UPSERT<br/>Increment occurrences<br/>Update last_seen_ts
    Trigger1->>SCCLT: UPSERT<br/>Add seat_address_normalized<br/>Increment occurrences
    
    SD->>Trigger2: UPDATE Record<br/>master_college_id<br/>master_course_id<br/>normalized_state
    Trigger2->>CCL: UPSERT<br/>Increment occurrences<br/>Update last_seen_ts
    Trigger2->>SCCLT: UPSERT<br/>Update seat_address_normalized<br/>Increment occurrences
    
    Sync->>Sync: ATTACH seat_data.db
    Sync->>SCCLT: SELECT with aggregation
    Sync->>Sync: JOIN states (resolve state_id)
    Sync->>Sync: JOIN state_mappings (aliases)
    Sync->>Sync: JOIN colleges (stream, address)
    Sync->>SCCL: UPSERT into master link table<br/>SUM occurrences<br/>MAX last_seen_ts
```

## Validation Strictness Flow

```mermaid
flowchart TD
    Input[Record: state, college_id, course_id]
    
    CheckStrictness{Validation<br/>Strictness}
    
    StrictMode[STRICT Mode]
    ModerateMode[MODERATE Mode]
    LenientMode[LENIENT Mode]
    
    CheckStateLink[Validate State-College Link<br/>state_college_link]
    
    CheckSeatEvidence[Check Seat Evidence<br/>state_course_college_link_text]
    
    StrictReject[REJECT: No Evidence]
    StrictAccept[ACCEPT: Both Valid]
    
    ModeratePrefer[PREFER: Evidence Present]
    ModerateAccept[ACCEPT: State Valid]
    
    LenientAccept[ACCEPT: State Valid]
    
    Input --> CheckStrictness
    
    CheckStrictness -->|strict| StrictMode
    CheckStrictness -->|moderate| ModerateMode
    CheckStrictness -->|lenient| LenientMode
    
    StrictMode --> CheckStateLink
    CheckStateLink -->|Valid| CheckSeatEvidence
    CheckStateLink -->|Invalid| StrictReject
    CheckSeatEvidence -->|Found| StrictAccept
    CheckSeatEvidence -->|Not Found| StrictReject
    
    ModerateMode --> CheckStateLink
    CheckStateLink -->|Valid| CheckSeatEvidence
    CheckStateLink -->|Invalid| StrictReject
    CheckSeatEvidence -->|Found| ModeratePrefer
    CheckSeatEvidence -->|Not Found| ModerateAccept
    
    LenientMode --> CheckStateLink
    CheckStateLink -->|Valid| LenientAccept
    CheckStateLink -->|Invalid| StrictReject
```

## Performance Optimization Flow

```mermaid
graph TB
    subgraph "Before Optimization"
        A1[Load ALL colleges<br/>2440+ records<br/>~10MB memory]
        A2[Python Filter: State<br/>~50ms]
        A3[Python Filter: Stream<br/>~30ms]
        A4[Python Filter: Course<br/>~40ms]
        A5[Python Match Names<br/>~100ms]
        A6[Total: ~220ms]
        
        A1 --> A2 --> A3 --> A4 --> A5 --> A6
    end
    
    subgraph "After Optimization"
        B1[SQL Query with JOINs<br/>10-50 candidates<br/>~200KB memory]
        B2[Cache Lookup: Course<br/>~1ms]
        B3[Cache Lookup: Seat Link<br/>~1ms]
        B4[Early Exit Matching<br/>~5ms]
        B5[Total: ~15ms<br/>15x faster]
        
        B1 --> B2 --> B3 --> B4 --> B5
    end
    
    A6 -.->|Optimization| B5
```

## Complete System Data Flow

```mermaid
graph TB
    subgraph "Input Sources"
        I1[Raw Seat Data]
        I2[Raw Counselling Data]
    end
    
    subgraph "Preprocessing"
        P1[Text Normalization]
        P2[State Normalization]
        P3[Address Normalization]
        P4[Course Type Detection]
    end
    
    subgraph "Filtering Stage"
        F1[State Filter<br/>state_college_link]
        F2[Stream Filter<br/>medical/dental/dnb]
        F3[Course Filter<br/>state_course_college_link_text]
    end
    
    subgraph "Matching Stage"
        M1[Exact Match]
        M2[Primary Match]
        M3[Prefix Match]
        M4[Fuzzy Match]
    end
    
    subgraph "Validation Stage"
        V1[State-College Validation]
        V2[Course-Stream Validation]
        V3[Address Validation]
    end
    
    subgraph "Output"
        O1[Linked Results]
        O2[Statistics]
        O3[Reports]
    end
    
    subgraph "Auto-Updates"
        U1[college_course_link Trigger]
        U2[state_course_college_link_text Trigger]
        U3[state_course_college_link Sync]
    end
    
    I1 --> P1
    I2 --> P1
    P1 --> P2
    P1 --> P3
    P1 --> P4
    
    P2 --> F1
    P4 --> F2
    F1 --> F2
    F2 --> F3
    
    F3 --> M1
    M1 -->|No Match| M2
    M2 -->|No Match| M3
    M3 -->|No Match| M4
    
    M1 --> V1
    M2 --> V1
    M3 --> V1
    M4 --> V1
    
    V1 --> V2
    V2 --> V3
    
    V3 --> O1
    O1 --> O2
    O2 --> O3
    
    O1 --> U1
    O1 --> U2
    U2 --> U3
```

These diagrams provide a visual representation of the complete workflow, architecture, and data flow of the matching and linking system.

