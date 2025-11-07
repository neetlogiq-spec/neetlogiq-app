'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: sendToErrorReportingService(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return <ErrorFallback 
        error={this.state.error} 
        onRetry={this.handleRetry} 
      />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className={`max-w-md w-full p-8 rounded-2xl shadow-lg ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
            isDarkMode ? 'bg-red-900/20' : 'bg-red-100'
          }`}>
            <AlertTriangle className={`w-8 h-8 ${
              isDarkMode ? 'text-red-400' : 'text-red-600'
            }`} />
          </div>
          
          <h1 className={`text-2xl font-bold mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Something went wrong
          </h1>
          
          <p className={`mb-6 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            We're sorry, but something unexpected happened. Our team has been notified about this issue.
          </p>
          
          {process.env.NODE_ENV === 'development' && error && (
            <details className={`mb-6 text-left p-4 rounded-lg ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <summary className={`cursor-pointer font-medium mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Error Details
              </summary>
              <pre className={`text-xs overflow-auto mt-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {error.toString()}
                {error.stack}
              </pre>
            </details>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onRetry}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            
            <Link
              href="/"
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for handling async errors in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    console.error('Async error caught:', error);
    setError(error);
    
    // In production, you might want to send this to an error reporting service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: sendToErrorReportingService(error);
    }
  }, []);

  // Throw error to be caught by ErrorBoundary
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
};

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default ErrorBoundary;

