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

  export class ParquetSchema {
    constructor(schema: any);
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

