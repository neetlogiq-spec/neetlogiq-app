/**
 * Optimized Cutoffs Page with Parquet + DuckDB-WASM
 */

'use client';

import { useState } from 'react';
import { useOptimizedParquetCutoffs } from '../../../hooks/useOptimizedParquetCutoffs';

export default function OptimizedCutoffsPage() {
  const [stream, setStream] = useState('UG');
  const [filterText, setFilterText] = useState('');
  
  const { data, loading, error, filter } = useOptimizedParquetCutoffs(stream);

  const handleFilter = () => {
    filter({ college: filterText });
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error.message}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Optimized Cutoffs</h1>
      
      <div className="mb-6">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter by college name..."
          className="border p-2 rounded mr-4"
        />
        <button
          onClick={handleFilter}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Filter
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">College</th>
              <th className="border p-2">Course</th>
              <th className="border p-2">Opening Rank</th>
              <th className="border p-2">Closing Rank</th>
              <th className="border p-2">Total Seats</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((record: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-2">{record.college_name}</td>
                <td className="border p-2">{record.course_name}</td>
                <td className="border p-2">{record.opening_rank}</td>
                <td className="border p-2">{record.closing_rank}</td>
                <td className="border p-2">{record.total_seats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {data.length} records (limited to 50 for display)
      </div>
    </div>
  );
}
