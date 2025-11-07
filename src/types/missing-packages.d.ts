// Custom type declarations for packages without @types

declare module 'fuse.js' {
  export interface FuseOptions<T> {
    keys: string[];
    threshold?: number;
    distance?: number;
    includeScore?: boolean;
    includeMatches?: boolean;
    minMatchCharLength?: number;
    shouldSort?: boolean;
    sortFn?: (a: any, b: any) => number;
    getFn?: (obj: any, path: string) => any;
    id?: string;
    verbose?: boolean;
    tokenize?: boolean;
    tokenSeparator?: string;
    matchAllTokens?: boolean;
    findAllMatches?: boolean;
    location?: number;
    findAllMatches?: boolean;
    maxPatternLength?: number;
    caseSensitive?: boolean;
    ignoreLocation?: boolean;
    useExtendedSearch?: boolean;
    ignoreFieldNorm?: boolean;
  }

  export interface FuseResult<T> {
    item: T;
    refIndex: number;
    score?: number;
    matches?: Array<{
      indices: number[][];
      value: string;
      key: string;
    }>;
  }

  export default class Fuse<T> {
    constructor(list: T[], options?: FuseOptions<T>);
    search(pattern: string): FuseResult<T>[];
    setCollection(list: T[]): void;
  }
}

declare module 'meilisearch' {
  export interface MeiliSearchConfig {
    host: string;
    apiKey?: string;
    headers?: Record<string, string>;
    timeout?: number;
  }

  export interface SearchParams {
    q?: string;
    offset?: number;
    limit?: number;
    attributesToRetrieve?: string[];
    attributesToCrop?: string[];
    cropLength?: number;
    attributesToHighlight?: string[];
    filter?: string | string[];
    sort?: string[];
    facets?: string[];
    facetFilters?: string | string[];
    attributesToSearchOn?: string[];
    showMatchesPosition?: boolean;
    showRankingScore?: boolean;
    showRankingScoreDetails?: boolean;
    highlightPreTag?: string;
    highlightPostTag?: string;
    cropMarker?: string;
    matchingStrategy?: 'all' | 'last';
    showRankingScore?: boolean;
    showRankingScoreDetails?: boolean;
  }

  export interface SearchResponse<T> {
    hits: T[];
    offset: number;
    limit: number;
    estimatedTotalHits: number;
    totalHits: number;
    totalPages: number;
    hitsPerPage: number;
    page: number;
    facetDistribution?: Record<string, Record<string, number>>;
    facetStats?: Record<string, { min: number; max: number }>;
    processingTimeMs: number;
    query: string;
  }

  export interface Index {
    uid: string;
    primaryKey?: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface Task {
    uid: number;
    indexUid: string;
    status: 'enqueued' | 'processing' | 'succeeded' | 'failed';
    type: string;
    details: any;
    error?: any;
    duration?: string;
    enqueuedAt: string;
    startedAt?: string;
    finishedAt?: string;
  }

  export interface EnqueuedTask {
    taskUid: number;
    indexUid: string;
    status: 'enqueued';
    type: string;
    enqueuedAt: string;
  }

  export class MeiliSearch {
    constructor(config: MeiliSearchConfig);
    index<T = any>(uid: string): Index<T>;
    createIndex(uid: string, options?: { primaryKey?: string }): Promise<EnqueuedTask>;
    deleteIndex(uid: string): Promise<EnqueuedTask>;
    getIndexes(): Promise<Index[]>;
    getIndex(uid: string): Promise<Index>;
    tasks: {
      getTask(taskUid: number): Promise<Task>;
      getTasks(): Promise<{ results: Task[]; limit: number; offset: number; total: number }>;
      waitForTask(taskUid: number, options?: { timeOutMs?: number; intervalMs?: number }): Promise<Task>;
    };
  }

  export interface Index<T = any> {
    uid: string;
    primaryKey?: string;
    createdAt: string;
    updatedAt: string;
    search(query: string, searchParams?: SearchParams): Promise<SearchResponse<T>>;
    addDocuments(documents: T[], options?: { primaryKey?: string }): Promise<EnqueuedTask>;
    updateDocuments(documents: T[], options?: { primaryKey?: string }): Promise<EnqueuedTask>;
    deleteDocuments(documentIds: string[]): Promise<EnqueuedTask>;
    deleteAllDocuments(): Promise<EnqueuedTask>;
    getDocument(documentId: string): Promise<T>;
    getDocuments(options?: { offset?: number; limit?: number; attributesToRetrieve?: string[] }): Promise<{ results: T[]; offset: number; limit: number; total: number }>;
    updateSettings(settings: any): Promise<EnqueuedTask>;
    getSettings(): Promise<any>;
    resetSettings(): Promise<EnqueuedTask>;
    deleteIndex(): Promise<EnqueuedTask>;
  }
}

declare module 'parquetjs' {
  export interface ParquetReader {
    getSchema(): any;
    getRowCount(): number;
    getMetadata(): any;
    readAllRecords(): Promise<any[]>;
    close(): Promise<void>;
  }

  export interface ParquetWriter {
    appendRowGroup(rows: any[]): Promise<void>;
    close(): Promise<void>;
  }

  export interface ParquetSchema {
    new(schema: any): ParquetSchema;
    fromSchema(schema: any): ParquetSchema;
  }

  export interface ParquetReaderOptions {
    [key: string]: any;
  }

  export interface ParquetWriterOptions {
    [key: string]: any;
  }

  export function ParquetReader(file: any, options?: ParquetReaderOptions): ParquetReader;
  export function ParquetWriter(schema: any, file: any, options?: ParquetWriterOptions): ParquetWriter;
  export function ParquetSchema(schema: any): ParquetSchema;
}

declare module 'parquetjs-lite' {
  export interface ParquetReader {
    getSchema(): any;
    getRowCount(): number;
    getMetadata(): any;
    readAllRecords(): Promise<any[]>;
    close(): Promise<void>;
  }

  export interface ParquetWriter {
    appendRowGroup(rows: any[]): Promise<void>;
    close(): Promise<void>;
  }

  export interface ParquetSchema {
    new(schema: any): ParquetSchema;
  }

  export interface ParquetReaderOptions {
    [key: string]: any;
  }

  export interface ParquetWriterOptions {
    [key: string]: any;
  }

  export function ParquetReader(file: any, options?: ParquetReaderOptions): ParquetReader;
  export function ParquetWriter(schema: any, file: any, options?: ParquetWriterOptions): ParquetWriter;
  export function ParquetSchema(schema: any): ParquetSchema;
}

declare module 'simdjson' {
  export function parse(json: string): any;
  export function parseAsync(json: string): Promise<any>;
  export function isValid(json: string): boolean;
  export function minify(json: string): string;
  export function prettify(json: string, indent?: number): string;
}

declare module 'sqlite' {
  export interface Database {
    run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }>;
    get(sql: string, params?: any[]): Promise<any>;
    all(sql: string, params?: any[]): Promise<any[]>;
    close(): Promise<void>;
  }

  export function open(filename: string): Promise<Database>;
}

declare module 'typesense' {
  export interface ClientConfig {
    nodes: Array<{ host: string; port: number; protocol: string }>;
    apiKey: string;
    connectionTimeoutSeconds?: number;
    numRetries?: number;
    retryIntervalSeconds?: number;
    healthcheckIntervalSeconds?: number;
  }

  export interface SearchParams {
    q: string;
    query_by: string;
    filter_by?: string;
    sort_by?: string;
    facet_by?: string;
    max_facet_values?: number;
    page?: number;
    per_page?: number;
    highlight_full_fields?: string;
    snippet_threshold?: number;
    num_typos?: number;
    typo_tokens_threshold?: number;
    drop_tokens_threshold?: number;
    pinned_hits?: string;
    hidden_hits?: string;
    highlight_affix_num_tokens?: number;
    highlight_start_tag?: string;
    highlight_end_tag?: string;
    enable_highlight_v1?: boolean;
    prioritize_exact_match?: boolean;
    prioritize_token_position?: boolean;
    prioritize_num_matching_fields?: boolean;
    exclude_fields?: string;
    include_fields?: string;
    group_by?: string;
    group_limit?: number;
    group_missing_values?: string;
    vector_query?: string;
    infix?: string;
    preset?: string;
    text_match_type?: string;
    text_match_type_2?: string;
    text_match_type_3?: string;
    text_match_type_4?: string;
    text_match_type_5?: string;
    text_match_type_6?: string;
    text_match_type_7?: string;
    text_match_type_8?: string;
    text_match_type_9?: string;
    text_match_type_10?: string;
    text_match_type_11?: string;
    text_match_type_12?: string;
    text_match_type_13?: string;
    text_match_type_14?: string;
    text_match_type_15?: string;
    text_match_type_16?: string;
    text_match_type_17?: string;
    text_match_type_18?: string;
    text_match_type_19?: string;
    text_match_type_20?: string;
    text_match_type_21?: string;
    text_match_type_22?: string;
    text_match_type_23?: string;
    text_match_type_24?: string;
    text_match_type_25?: string;
    text_match_type_26?: string;
    text_match_type_27?: string;
    text_match_type_28?: string;
    text_match_type_29?: string;
    text_match_type_30?: string;
    text_match_type_31?: string;
    text_match_type_32?: string;
    text_match_type_33?: string;
    text_match_type_34?: string;
    text_match_type_35?: string;
    text_match_type_36?: string;
    text_match_type_37?: string;
    text_match_type_38?: string;
    text_match_type_39?: string;
    text_match_type_40?: string;
    text_match_type_41?: string;
    text_match_type_42?: string;
    text_match_type_43?: string;
    text_match_type_44?: string;
    text_match_type_45?: string;
    text_match_type_46?: string;
    text_match_type_47?: string;
    text_match_type_48?: string;
    text_match_type_49?: string;
    text_match_type_50?: string;
    text_match_type_51?: string;
    text_match_type_52?: string;
    text_match_type_53?: string;
    text_match_type_54?: string;
    text_match_type_55?: string;
    text_match_type_56?: string;
    text_match_type_57?: string;
    text_match_type_58?: string;
    text_match_type_59?: string;
    text_match_type_60?: string;
    text_match_type_61?: string;
    text_match_type_62?: string;
    text_match_type_63?: string;
    text_match_type_64?: string;
    text_match_type_65?: string;
    text_match_type_66?: string;
    text_match_type_67?: string;
    text_match_type_68?: string;
    text_match_type_69?: string;
    text_match_type_70?: string;
    text_match_type_71?: string;
    text_match_type_72?: string;
    text_match_type_73?: string;
    text_match_type_74?: string;
    text_match_type_75?: string;
    text_match_type_76?: string;
    text_match_type_77?: string;
    text_match_type_78?: string;
    text_match_type_79?: string;
    text_match_type_80?: string;
    text_match_type_81?: string;
    text_match_type_82?: string;
    text_match_type_83?: string;
    text_match_type_84?: string;
    text_match_type_85?: string;
    text_match_type_86?: string;
    text_match_type_87?: string;
    text_match_type_88?: string;
    text_match_type_89?: string;
    text_match_type_90?: string;
    text_match_type_91?: string;
    text_match_type_92?: string;
    text_match_type_93?: string;
    text_match_type_94?: string;
    text_match_type_95?: string;
    text_match_type_96?: string;
    text_match_type_97?: string;
    text_match_type_98?: string;
    text_match_type_99?: string;
    text_match_type_100?: string;
  }

  export interface SearchResponse<T> {
    found: number;
    page: number;
    facet_counts: Array<{ field_name: string; counts: Array<{ count: number; highlighted: string; value: string }> }>;
    hits: Array<{
      document: T;
      text_match: number;
      text_match_info: any;
      highlights: Array<{ field: string; matched_tokens: string[]; snippet: string }>;
      highlights_full: Array<{ field: string; matched_tokens: string[]; snippet: string }>;
      highlights_snippet: Array<{ field: string; matched_tokens: string[]; snippet: string }>;
      rank: number;
      vector_distance?: number;
    }>;
    search_time_ms: number;
    facet_counts: Array<{ field_name: string; counts: Array<{ count: number; highlighted: string; value: string }> }>;
    grouped_hits?: Array<{
      group_key: string[];
      hits: Array<{
        document: T;
        text_match: number;
        text_match_info: any;
        highlights: Array<{ field: string; matched_tokens: string[]; snippet: string }>;
        highlights_full: Array<{ field: string; matched_tokens: string[]; snippet: string }>;
        highlights_snippet: Array<{ field: string; matched_tokens: string[]; snippet: string }>;
        rank: number;
        vector_distance?: number;
      }>;
    }>;
  }

  export class Client {
    constructor(config: ClientConfig);
    collections<T = any>(name: string): Collection<T>;
    health(): Promise<{ ok: boolean }>;
  }

  export interface Collection<T = any> {
    create(schema: any): Promise<any>;
    retrieve(): Promise<any>;
    update(schema: any): Promise<any>;
    delete(): Promise<any>;
    documents(): Documents<T>;
  }

  export interface Documents<T = any> {
    create(document: T): Promise<any>;
    upsert(document: T): Promise<any>;
    update(document: T): Promise<any>;
    delete(documentId: string): Promise<any>;
    search(searchParams: SearchParams): Promise<SearchResponse<T>>;
  }
}

declare module 'apache-arrow' {
  export interface Table {
    new(data: any): Table;
    toArray(): any[];
    toJSON(): any[];
    getColumn(name: string): any;
    numRows: number;
    numCols: number;
    schema: Schema;
  }

  export interface Schema {
    new(fields: Field[]): Schema;
    fields: Field[];
  }

  export interface Field {
    new(name: string, type: DataType): Field;
    name: string;
    type: DataType;
  }

  export interface DataType {
    new(): DataType;
  }

  export interface Int {
    new(): Int;
  }

  export interface Utf8 {
    new(): Utf8;
  }

  export interface Float {
    new(): Float;
  }

  export interface RecordBatch {
    new(data: any): RecordBatch;
    toArray(): any[];
  }

  export const Table: typeof Table;
  export const Schema: typeof Schema;
  export const Field: typeof Field;
  export const Int: typeof Int;
  export const Utf8: typeof Utf8;
  export const Float: typeof Float;
  export const RecordBatch: typeof RecordBatch;
}
