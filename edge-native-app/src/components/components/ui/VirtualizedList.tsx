'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List, VariableSizeList as VariableList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Item renderer props interface
interface ItemRendererProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: any[];
    renderItem: (item: any, index: number) => React.ReactNode;
    getItemKey?: (item: any, index: number) => string;
  };
}

// Default item renderer
const ItemRenderer: React.FC<ItemRendererProps> = ({ index, style, data }) => {
  const { items, renderItem, getItemKey } = data;
  const item = items[index];
  
  return (
    <div style={style} key={getItemKey ? getItemKey(item, index) : index}>
      {renderItem(item, index)}
    </div>
  );
};

// Virtualized list component props
interface VirtualizedListProps {
  items: any[];
  height: number;
  itemHeight?: number | ((index: number) => number);
  width?: string | number;
  renderItem: (item: any, index: number) => React.ReactNode;
  getItemKey?: (item: any, index: number) => string;
  overscanCount?: number;
  className?: string;
  variableHeight?: boolean;
}

// Basic virtualized list with fixed item heights
export const VirtualizedList: React.FC<VirtualizedListProps> = ({
  items,
  height,
  itemHeight = 60,
  width = '100%',
  renderItem,
  getItemKey,
  overscanCount = 5,
  className = '',
  variableHeight = false
}) => {
  const { isDarkMode } = useTheme();
  const listRef = useRef<List>(null);
  
  const itemData = useMemo(() => ({
    items,
    renderItem,
    getItemKey
  }), [items, renderItem, getItemKey]);
  
  const scrollToItem = useCallback((index: number, align: 'auto' | 'smart' | 'center' | 'end' | 'start' = 'auto') => {
    if (listRef.current) {
      listRef.current.scrollToItem(index, align);
    }
  }, []);
  
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, []);
  
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(items.length - 1);
    }
  }, [items.length]);
  
  if (variableHeight) {
    return (
      <VariableList
        ref={listRef}
        height={height}
        itemCount={items.length}
        itemSize={itemHeight as (index: number) => number}
        itemData={itemData}
        overscanCount={overscanCount}
        className={className}
      >
        {ItemRenderer}
      </VariableList>
    );
  }
  
  return (
    <div className={`virtualized-list-container ${isDarkMode ? 'dark' : ''} ${className}`}>
      <List
        ref={listRef}
        height={height}
        itemCount={items.length}
        itemSize={itemHeight as number}
        itemData={itemData}
        overscanCount={overscanCount}
        width={width}
      >
        {ItemRenderer}
      </List>
      
      {/* Scroll controls */}
      <div className="flex justify-center gap-2 mt-2">
        <button
          onClick={scrollToTop}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode 
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' 
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
          title="Scroll to top"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={scrollToBottom}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode 
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' 
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
          title="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Infinite scroll list props
interface InfiniteVirtualizedListProps extends Omit<VirtualizedListProps, 'items'> {
  hasNextPage: boolean;
  isNextPageLoading: boolean;
  loadNextPage: () => Promise<void>;
  threshold?: number;
  minimumBatchSize?: number;
}

// Infinite scroll virtualized list
export const InfiniteVirtualizedList: React.FC<InfiniteVirtualizedListProps> = ({
  hasNextPage,
  isNextPageLoading,
  loadNextPage,
  threshold = 800,
  minimumBatchSize = 10,
  ...listProps
}) => {
  const { isDarkMode } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loadedItemCount, setLoadedItemCount] = useState(0);
  
  // Update items when props change
  useEffect(() => {
    setItems(listProps.items);
    setLoadedItemCount(listProps.items.length);
  }, [listProps.items]);
  
  // Load more items
  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (hasNextPage && !isNextPageLoading) {
      await loadNextPage();
    }
  }, [hasNextPage, isNextPageLoading, loadNextPage]);
  
  // Check if item is loaded
  const isItemLoaded = useCallback((index: number) => {
    return !!items[index];
  }, [items]);
  
  const itemData = useMemo(() => ({
    items,
    renderItem: listProps.renderItem,
    getItemKey: listProps.getItemKey
  }), [items, listProps.renderItem, listProps.getItemKey]);
  
  return (
    <div className={`infinite-virtualized-list-container ${isDarkMode ? 'dark' : ''} ${listProps.className || ''}`}>
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={hasNextPage ? loadedItemCount + 1 : loadedItemCount}
        loadMoreItems={loadMoreItems}
        threshold={threshold}
        minimumBatchSize={minimumBatchSize}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={ref}
            height={listProps.height}
            itemCount={hasNextPage ? loadedItemCount + 1 : loadedItemCount}
            itemSize={listProps.itemHeight as number || 60}
            itemData={itemData}
            overscanCount={listProps.overscanCount || 5}
            width={listProps.width || '100%'}
            onItemsRendered={onItemsRendered}
          >
            {({ index, style }) => {
              // Show loading indicator at the bottom
              if (index === loadedItemCount) {
                return (
                  <div style={style} className="flex justify-center items-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                );
              }
              
              // Render actual item
              return (
                <div style={style} key={listProps.getItemKey ? listProps.getItemKey(items[index], index) : index}>
                  {listProps.renderItem(items[index], index)}
                </div>
              );
            }}
          </List>
        )}
      </InfiniteLoader>
    </div>
  );
};

// Grid virtualized list props
interface VirtualizedGridProps {
  items: any[];
  height: number;
  width: string | number;
  columnCount: number;
  rowHeight?: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  getItemKey?: (item: any, index: number) => string;
  overscanCount?: number;
  className?: string;
  gap?: number;
}

// Grid virtualized list
export const VirtualizedGrid: React.FC<VirtualizedGridProps> = ({
  items,
  height,
  width = '100%',
  columnCount,
  rowHeight = 200,
  renderItem,
  getItemKey,
  overscanCount = 5,
  className = '',
  gap = 16
}) => {
  const { isDarkMode } = useTheme();
  
  // Calculate rows needed
  const rowCount = Math.ceil(items.length / columnCount);
  
  // Get item at specific row and column
  const getItemAtIndex = useCallback((index: number) => {
    const rowIndex = Math.floor(index / columnCount);
    const columnIndex = index % columnCount;
    const itemIndex = rowIndex * columnCount + columnIndex;
    
    return items[itemIndex] || null;
  }, [items, columnCount]);
  
  // Item renderer for grid
  const GridItemRenderer: React.FC<{ index: number; style: React.CSSProperties }> = ({ index, style }) => {
    const item = getItemAtIndex(index);
    
    if (!item) {
      return <div style={style} />;
    }
    
    const actualIndex = Math.floor(index / columnCount) * columnCount + (index % columnCount);
    
    return (
      <div 
        style={{
          ...style,
          paddingRight: index % columnCount < columnCount - 1 ? gap : 0,
          paddingBottom: gap
        }}
        key={getItemKey ? getItemKey(item, actualIndex) : actualIndex}
      >
        {renderItem(item, actualIndex)}
      </div>
    );
  };
  
  return (
    <div className={`virtualized-grid-container ${isDarkMode ? 'dark' : ''} ${className}`}>
      <List
        height={height}
        itemCount={rowCount}
        itemSize={rowHeight}
        width={width}
        overscanCount={overscanCount}
      >
        {GridItemRenderer}
      </List>
    </div>
  );
};

// Hook for virtualized list with search and filtering
export const useVirtualizedList = <T = any>(
  items: T[],
  options: {
    itemHeight?: number | ((index: number) => number);
    filterFn?: (item: T, index: number) => boolean;
    sortFn?: (a: T, b: T) => number;
    searchQuery?: string;
    searchFields?: (keyof T)[];
  } = {}
) => {
  const {
    itemHeight = 60,
    filterFn,
    sortFn,
    searchQuery,
    searchFields = []
  } = options;
  
  const [filteredItems, setFilteredItems] = useState<T[]>([]);
  
  // Apply search, filter, and sort
  useEffect(() => {
    let result = [...items];
    
    // Apply search
    if (searchQuery && searchFields.length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(query);
        })
      );
    }
    
    // Apply filter
    if (filterFn) {
      result = result.filter(filterFn);
    }
    
    // Apply sort
    if (sortFn) {
      result.sort(sortFn);
    }
    
    setFilteredItems(result);
  }, [items, filterFn, sortFn, searchQuery, searchFields]);
  
  return {
    items: filteredItems,
    itemHeight,
    totalCount: filteredItems.length
  };
};

export default VirtualizedList;

