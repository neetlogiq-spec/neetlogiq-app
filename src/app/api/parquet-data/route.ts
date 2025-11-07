// API route to serve parquet data for client-side loading
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const parquetPath = '/Users/kashyapanand/Public/New/output/counselling_data_export_20251029_001424.parquet';
    
    // Check if file exists
    if (!fs.existsSync(parquetPath)) {
      return NextResponse.json({ error: 'Parquet file not found' }, { status: 404 });
    }

    // Use a simpler approach with pandas
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec(`python3 -c "
import pandas as pd
import json
import sys

try:
    df = pd.read_parquet('${parquetPath}')
    # Return first 1000 records to avoid memory issues
    subset = df.head(1000)
    result = subset.to_dict('records')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'error': str(e)}))
"`, (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error('Python execution error:', error);
          resolve(NextResponse.json({ error: 'Failed to execute Python script' }, { status: 500 }));
          return;
        }

        try {
          const jsonData = JSON.parse(stdout);
          if (jsonData.error) {
            resolve(NextResponse.json({ error: jsonData.error }, { status: 500 }));
          } else {
            resolve(NextResponse.json(jsonData));
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          console.error('Raw output:', stdout);
          resolve(NextResponse.json({ error: 'Failed to parse data' }, { status: 500 }));
        }
      });
    });

  } catch (error) {
    console.error('Error loading parquet data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
