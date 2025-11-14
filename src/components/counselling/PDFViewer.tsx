'use client';

import React, { useState } from 'react';
import { Download, ExternalLink, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { showSuccess, showError } from '@/lib/toast';

interface PDFViewerProps {
  document: {
    id: string;
    title: string;
    fileUrl: string;
    fileSize: string;
  };
}

const PDFViewer: React.FC<PDFViewerProps> = ({ document }) => {
  const { isDarkMode } = useTheme();
  const [zoom, setZoom] = useState(100);

  const handleDownload = () => {
    // Trigger download
    const link = window.document.createElement('a');
    link.href = document.fileUrl;
    link.download = document.title + '.pdf';
    link.click();
    showSuccess('Download started');
  };

  const handleOpenInNewTab = () => {
    window.open(document.fileUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDarkMode ? 'border-white/10' : 'border-gray-200'
      }`}>
        <h3 className={`font-semibold text-sm truncate flex-1 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {document.title}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'hover:bg-white/10 text-gray-300'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {zoom}%
          </span>

          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'hover:bg-white/10 text-gray-300'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>

          <button
            onClick={handleOpenInNewTab}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'hover:bg-white/10 text-gray-300'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Open in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
            }`}
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Preview */}
      <div className={`flex-1 overflow-auto p-4 ${
        isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'
      }`}>
        <div
          className="bg-white mx-auto shadow-2xl"
          style={{
            width: `${zoom}%`,
            minHeight: '500px'
          }}
        >
          {/* Placeholder for actual PDF rendering */}
          <div className="aspect-[8.5/11] flex items-center justify-center border border-gray-200">
            <div className="text-center p-8">
              <Maximize2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-4">
                PDF Preview
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {document.title}
              </p>
              <button
                onClick={handleOpenInNewTab}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Full PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className={`p-4 border-t text-xs ${
        isDarkMode
          ? 'border-white/10 text-gray-400'
          : 'border-gray-200 text-gray-600'
      }`}>
        <p>
          For best viewing experience, download the PDF or open in a new tab.
          File size: {document.fileSize}
        </p>
      </div>
    </div>
  );
};

export default PDFViewer;
