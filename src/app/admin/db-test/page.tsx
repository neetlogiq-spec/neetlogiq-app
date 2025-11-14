'use client';

import { useEffect, useState } from 'react';

interface TestResult {
  timestamp: string;
  status: string;
  connection: {
    status: string;
    message: string;
    url?: string;
  };
  schema: {
    expectedTables: number;
    existingTables: number;
    missingTables: string[];
  };
  foundationData: Array<{
    table: string;
    expected: number;
    actual: number;
    status: string;
    description: string;
  }>;
  views: Array<{
    name: string;
    status: string;
  }>;
  criticalTables: Array<{
    name: string;
    status: string;
    rows: number;
  }>;
  summary: {
    allTablesExist: boolean;
    foundationDataPopulated: boolean;
    viewsExist: boolean;
    ready: boolean;
  };
}

export default function DatabaseTestPage() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/test-db-connection');
      const data = await response.json();

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Testing database connection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-red-600 mb-4">❌ Connection Error</h1>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={runTest}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'ready':
      case 'complete':
      case 'exists':
        return 'text-green-600 bg-green-50';
      case 'partial':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
      case 'error':
      case 'empty':
      case 'missing':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'ready':
      case 'complete':
      case 'exists':
        return '✓';
      case 'partial':
        return '⚠';
      case 'failed':
      case 'error':
      case 'empty':
      case 'missing':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-gray-800">
              🔌 Database Connection Test
            </h1>
            <button
              onClick={runTest}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <span>🔄</span> Refresh
            </button>
          </div>
          <p className="text-gray-600">Testing Supabase connection and complete hybrid schema</p>
          <p className="text-sm text-gray-500 mt-2">Last tested: {new Date(result.timestamp).toLocaleString()}</p>
        </div>

        {/* Overall Status */}
        <div className={`rounded-lg shadow-xl p-8 mb-8 ${result.summary.ready ? 'bg-green-50 border-2 border-green-500' : 'bg-yellow-50 border-2 border-yellow-500'}`}>
          <div className="flex items-center gap-4">
            <span className="text-6xl">{result.summary.ready ? '✅' : '⚠️'}</span>
            <div>
              <h2 className="text-3xl font-bold">{result.summary.ready ? 'Database Ready!' : 'Database Incomplete'}</h2>
              <p className="text-gray-700 mt-2">
                {result.summary.ready
                  ? 'All checks passed. Database is ready for use.'
                  : 'Some components need attention. Review details below.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Connection Status */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>🔗</span> Connection
            </h3>
            <div className={`p-4 rounded-lg ${getStatusColor(result.connection.status)}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getStatusIcon(result.connection.status)}</span>
                <span className="font-semibold">{result.connection.status.toUpperCase()}</span>
              </div>
              <p>{result.connection.message}</p>
              {result.connection.url && (
                <p className="text-sm mt-2 font-mono">{result.connection.url}</p>
              )}
            </div>
          </div>

          {/* Schema Status */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>📋</span> Schema
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Expected Tables:</span>
                <span className="font-semibold">{result.schema.expectedTables}</span>
              </div>
              <div className="flex justify-between">
                <span>Existing Tables:</span>
                <span className={`font-semibold ${result.schema.existingTables === result.schema.expectedTables ? 'text-green-600' : 'text-red-600'}`}>
                  {result.schema.existingTables}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Missing Tables:</span>
                <span className={`font-semibold ${result.schema.missingTables.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.schema.missingTables.length}
                </span>
              </div>
            </div>
            {result.schema.missingTables.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 rounded">
                <p className="font-semibold text-red-800 mb-2">Missing Tables:</p>
                <div className="max-h-40 overflow-y-auto">
                  {result.schema.missingTables.map((table) => (
                    <div key={table} className="text-sm text-red-700 font-mono">• {table}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Foundation Data */}
        <div className="bg-white rounded-lg shadow-xl p-6 mt-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📊</span> Foundation Data
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.foundationData.map((item) => (
              <div key={item.table} className={`p-4 rounded-lg ${getStatusColor(item.status)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{getStatusIcon(item.status)}</span>
                  <span className="font-semibold font-mono">{item.table}</span>
                </div>
                <p className="text-sm mb-1">{item.description}</p>
                <p className="text-sm">
                  <span className="font-semibold">{item.actual}</span> / {item.expected} rows
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Views */}
        <div className="bg-white rounded-lg shadow-xl p-6 mt-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>👁️</span> Views
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.views.map((view) => (
              <div key={view.name} className={`p-4 rounded-lg ${getStatusColor(view.status)}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getStatusIcon(view.status)}</span>
                  <span className="font-semibold font-mono">{view.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Tables */}
        <div className="bg-white rounded-lg shadow-xl p-6 mt-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🎯</span> Critical Tables
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {result.criticalTables.map((table) => (
              <div key={table.name} className={`p-4 rounded-lg ${getStatusColor(table.status)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{getStatusIcon(table.status)}</span>
                  <span className="font-semibold font-mono">{table.name}</span>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{table.rows}</span> rows
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-xl p-6 mt-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📈</span> Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <span className="text-2xl">{result.summary.allTablesExist ? '✓' : '✗'}</span>
              <span>All tables exist</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <span className="text-2xl">{result.summary.foundationDataPopulated ? '✓' : '✗'}</span>
              <span>Foundation data populated</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <span className="text-2xl">{result.summary.viewsExist ? '✓' : '✗'}</span>
              <span>Views exist</span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        {!result.summary.ready && (
          <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg shadow-xl p-6 mt-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>💡</span> Next Steps
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              {!result.summary.allTablesExist && (
                <li>Apply the complete hybrid schema migration in Supabase Dashboard</li>
              )}
              {!result.summary.foundationDataPopulated && (
                <li>Run foundation_data_population.sql to populate reference data</li>
              )}
              {!result.summary.viewsExist && (
                <li>Ensure all views are created (check migration file)</li>
              )}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
