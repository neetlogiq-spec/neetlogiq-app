'use client';

import React, { useState } from 'react';
import { Code, Play, Lightbulb, Bug, Zap, RefreshCw, Copy, Check, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { bmadAI } from '@/services/bmad-ai';

interface BMADCodingAssistantProps {
  initialCode?: string;
  language?: string;
  context?: 'medical-education' | 'neet-logic' | 'data-analysis' | 'ui-component';
  onCodeChange?: (code: string) => void;
}

const BMADCodingAssistant: React.FC<BMADCodingAssistantProps> = ({
  initialCode = '',
  language = 'typescript',
  context = 'medical-education',
  onCodeChange
}) => {
  const [code, setCode] = useState(initialCode);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [selectedContext, setSelectedContext] = useState(context);
  const [task, setTask] = useState<'explain' | 'optimize' | 'debug' | 'generate' | 'refactor'>('explain');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const languages = [
    { value: 'typescript', label: 'TypeScript' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'sql', label: 'SQL' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' }
  ];

  const contexts = [
    { value: 'medical-education', label: 'Medical Education' },
    { value: 'neet-logic', label: 'NEET Logic' },
    { value: 'data-analysis', label: 'Data Analysis' },
    { value: 'ui-component', label: 'UI Component' }
  ];

  const tasks = [
    { value: 'explain', label: 'Explain Code', icon: Info, color: 'blue' },
    { value: 'optimize', label: 'Optimize', icon: Zap, color: 'green' },
    { value: 'debug', label: 'Debug', icon: Bug, color: 'red' },
    { value: 'generate', label: 'Generate', icon: Code, color: 'purple' },
    { value: 'refactor', label: 'Refactor', icon: RefreshCw, color: 'orange' }
  ];

  const handleAnalyze = async () => {
    if (!code.trim() && task !== 'generate') {
      setError('Please enter some code to analyze');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response;
      
      switch (task) {
        case 'explain':
          response = await bmadAI.explainCode(code, selectedLanguage, selectedContext);
          break;
        case 'optimize':
          response = await bmadAI.optimizeCode(code, selectedLanguage, selectedContext);
          break;
        case 'debug':
          response = await bmadAI.debugCode(code, selectedLanguage, selectedContext);
          break;
        case 'generate':
          response = await bmadAI.analyzeCode({
            code: '',
            language: selectedLanguage,
            context: selectedContext as any,
            task: 'generate',
            additionalContext: task
          });
          break;
        case 'refactor':
          response = await bmadAI.refactorCode(code, selectedLanguage, selectedContext);
          break;
        default:
          throw new Error('Invalid task selected');
      }

      if (typeof response === 'object' && response.success) {
        setResult(response);
        if (response.result.optimizedCode || response.result.generatedCode || response.result.refactoredCode) {
          const newCode = response.result.optimizedCode || response.result.generatedCode || response.result.refactoredCode;
          if (newCode && onCodeChange) {
            onCodeChange(newCode);
          }
        }
      } else {
        setError('Failed to analyze code. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while analyzing the code.');
      console.error('BMAD AI Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (codeToCopy: string) => {
    navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'info': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertCircle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              BMAD AI Coding Assistant
            </h3>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Powered by BMAD AI
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-4 space-y-4">
        {/* Language and Context Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Programming Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Context
            </label>
            <select
              value={selectedContext}
              onChange={(e) => setSelectedContext(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {contexts.map((ctx) => (
                <option key={ctx.value} value={ctx.value}>
                  {ctx.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Task
            </label>
            <select
              value={task}
              onChange={(e) => setTask(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {tasks.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Code Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Code Input
          </label>
          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (onCodeChange) onCodeChange(e.target.value);
            }}
            placeholder="Enter your code here..."
            className="w-full h-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{loading ? 'Analyzing...' : 'Analyze Code'}</span>
          </button>

          <div className="flex space-x-1">
            {tasks.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setTask(t.value as any)}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    task === t.value
                      ? `bg-${t.color}-100 dark:bg-${t.color}-900 text-${t.color}-600 dark:text-${t.color}-400`
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={t.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      {(result || error) && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-red-800 dark:text-red-200">{error}</span>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Explanation */}
              {result.result.explanation && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Explanation</h4>
                      <p className="text-blue-800 dark:text-blue-300 text-sm">{result.result.explanation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Optimized/Generated/Refactored Code */}
              {(result.result.optimizedCode || result.result.generatedCode || result.result.refactoredCode) && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {result.result.optimizedCode ? 'Optimized Code' : 
                       result.result.generatedCode ? 'Generated Code' : 'Refactored Code'}
                    </h4>
                    <button
                      onClick={() => handleCopyCode(result.result.optimizedCode || result.result.generatedCode || result.result.refactoredCode)}
                      className="flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                    <code>{result.result.optimizedCode || result.result.generatedCode || result.result.refactoredCode}</code>
                  </pre>
                </div>
              )}

              {/* Issues */}
              {result.result.issues && result.result.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">Issues Found</h4>
                  {result.result.issues.map((issue: any, index: number) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className={`mt-0.5 ${getSeverityColor(issue.severity)}`}>
                        {getSeverityIcon(issue.severity)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Line {issue.line}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            issue.severity === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <strong>Suggestion:</strong> {issue.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {result.result.suggestions && result.result.suggestions.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900 dark:text-green-200 mb-2">Suggestions</h4>
                      <ul className="text-green-800 dark:text-green-300 text-sm space-y-1">
                        {result.result.suggestions.map((suggestion: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Medical Education Insights */}
              {result.result.medicalEducationInsights && result.result.medicalEducationInsights.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-purple-900 dark:text-purple-200 mb-2">Medical Education Insights</h4>
                      <ul className="text-purple-800 dark:text-purple-300 text-sm space-y-1">
                        {result.result.medicalEducationInsights.map((insight: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Best Practices */}
              {result.result.bestPractices && result.result.bestPractices.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-900 dark:text-orange-200 mb-2">Best Practices</h4>
                      <ul className="text-orange-800 dark:text-orange-300 text-sm space-y-1">
                        {result.result.bestPractices.map((practice: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{practice}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {result.metadata && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Processing time: {Math.round(result.metadata.processingTime)}ms</span>
                    <span>Confidence: {Math.round(result.metadata.confidence * 100)}%</span>
                    <span>Model: {result.metadata.model}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BMADCodingAssistant;
