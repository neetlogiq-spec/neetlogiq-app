'use client';

import { useState, useEffect } from 'react';

interface ParquetRecord {
  [key: string]: any;
}

interface EditableCell {
  rowIndex: number;
  columnName: string;
  originalValue: any;
  newValue: any;
}

export default function ParquetDatabaseEditor() {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [data, setData] = useState<ParquetRecord[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedCells, setEditedCells] = useState<Map<string, EditableCell>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  
  const RECORDS_PER_PAGE = 50;
  
  const availableTables = [
    { name: 'colleges', label: 'Colleges Data', file: 'colleges.parquet' },
    { name: 'programs', label: 'Programs Data', file: 'programs.parquet' },
    { name: 'cutoffs', label: 'Cutoffs Data', file: 'cutoffs.parquet' },
    { name: 'seat_data', label: 'Seat Data', file: 'seat_data.parquet' }
  ];

  const loadTableData = async (tableName: string, page: number = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        table: tableName,
        page: page.toString(),
        limit: RECORDS_PER_PAGE.toString(),
        search: searchTerm,
        filterColumn: filterColumn
      });
      
      const response = await fetch(`/api/parquet/database-editor?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result.data || []);
      setColumns(result.columns || []);
      setTotalRecords(result.total || 0);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, 1);
    }
  }, [selectedTable, searchTerm, filterColumn]);

  const handleCellEdit = (rowIndex: number, columnName: string, newValue: any) => {
    const cellKey = `${rowIndex}_${columnName}`;
    const originalValue = data[rowIndex][columnName];
    
    if (newValue !== originalValue) {
      setEditedCells(prev => new Map(prev.set(cellKey, {
        rowIndex,
        columnName,
        originalValue,
        newValue
      })));
    } else {
      setEditedCells(prev => {
        const newMap = new Map(prev);
        newMap.delete(cellKey);
        return newMap;
      });
    }
    
    // Update local data immediately for UI feedback
    setData(prev => prev.map((row, index) => 
      index === rowIndex ? { ...row, [columnName]: newValue } : row
    ));
  };

  const exportChangesAsCSV = () => {
    if (editedCells.size === 0) {
      alert('No changes to export');
      return;
    }

    const changes = Array.from(editedCells.values());
    const csvContent = [
      ['Row Index', 'Column', 'Original Value', 'New Value'],
      ...changes.map(change => [
        change.rowIndex.toString(),
        change.columnName,
        change.originalValue?.toString() || '',
        change.newValue?.toString() || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_changes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportTableAsCSV = () => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    const csvContent = [
      columns,
      ...data.map(row => columns.map(col => row[col]?.toString() || ''))
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const discardChanges = () => {
    setEditedCells(new Map());
    loadTableData(selectedTable, currentPage);
  };

  const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);

  const getCellStyle = (rowIndex: number, columnName: string) => {
    const cellKey = `${rowIndex}_${columnName}`;
    const isEdited = editedCells.has(cellKey);
    
    return isEdited 
      ? 'bg-yellow-50 border-yellow-300 text-yellow-900' 
      : 'bg-white border-gray-300';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🗄️ Parquet Database Editor
          </h1>
          <p className="text-gray-600">
            Edit your Parquet files directly through a web interface
          </p>
        </div>

        {/* Table Selection */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Select Table to Edit</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {availableTables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  selectedTable === table.name
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{table.label}</div>
                <div className="text-sm text-gray-500">{table.file}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedTable && (
          <>
            {/* Controls */}
            <div className="mb-6 bg-white rounded-lg shadow p-6">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4 items-center">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={filterColumn}
                    onChange={(e) => setFilterColumn(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Columns</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-2">
                  {editedCells.size > 0 && (
                    <>
                      <span className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                        {editedCells.size} changes pending
                      </span>
                      <button
                        onClick={discardChanges}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        Discard
                      </button>
                      <button
                        onClick={() => exportChangesAsCSV()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Export Changes as CSV
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => exportTableAsCSV()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Export Table as CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Loading data...</p>
                </div>
              ) : error ? (
                <div className="p-8 text-center">
                  <div className="text-red-600 mb-4">{error}</div>
                  <button
                    onClick={() => loadTableData(selectedTable, currentPage)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {columns.map((column) => (
                            <th
                              key={column}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {columns.map((column) => (
                              <td
                                key={column}
                                className={`px-4 py-2 text-sm border ${getCellStyle(rowIndex, column)}`}
                              >
                                <input
                                  type="text"
                                  value={row[column] || ''}
                                  onChange={(e) => handleCellEdit(rowIndex, column, e.target.value)}
                                  className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {((currentPage - 1) * RECORDS_PER_PAGE) + 1} to {Math.min(currentPage * RECORDS_PER_PAGE, totalRecords)} of {totalRecords} results
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadTableData(selectedTable, currentPage - 1)}
                          disabled={currentPage <= 1}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => loadTableData(selectedTable, currentPage + 1)}
                          disabled={currentPage >= totalPages}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-blue-800 font-semibold mb-2">💡 How to Use:</h3>
          <div className="text-blue-700 text-sm space-y-1">
            <p>1. 📊 Select a table from the options above</p>
            <p>2. 🔍 Use search and filter to find specific records</p>
            <p>3. ✏️ Click any cell to edit its value</p>
            <p>4. 💛 Edited cells will be highlighted in yellow</p>
            <p>5. 📁 Export changes as CSV to apply them manually</p>
            <p>6. 📊 Export full table as CSV for external editing</p>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 text-sm">
              <strong>💡 Recommended Workflow:</strong> Use this viewer to identify changes needed, 
              export as CSV, then apply the changes to your original Excel files using Find & Replace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
