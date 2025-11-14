'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, TrendingUp, BookOpen, Zap, Download, Share2, RotateCcw, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import ShareButtons from '@/components/ui/ShareButtons';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  data?: any; // For structured data like college predictions
}

interface Prediction {
  college: string;
  probability: number;
  category: 'safe' | 'moderate' | 'reach';
  cutoff?: number;
  reasoning?: string;
}

const SmartChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Welcome to NEETLogiq Smart Predictor! 🎓\n\nI can help you with:\n• College predictions based on your rank\n• Probability calculations for admissions\n• Compare colleges and cutoffs\n• Answer questions about medical admissions\n\nTry asking: "What are my chances with rank 5000?" or "Show me colleges under ₹5L fees"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({
    rank: null as number | null,
    category: 'GENERAL',
    state: '',
    budget: null as number | null,
  });
  const [showShareModal, setShowShareModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call Smart API
      const response = await fetch('/api/smart/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          context: {
            previousMessages: messages.slice(-5), // Last 5 messages for context
            userProfile,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          data: data.predictions && data.predictions.length > 0 ? { predictions: data.predictions } : undefined,
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Update user profile if extracted
        if (data.extractedProfile) {
          setUserProfile(prev => ({ ...prev, ...data.extractedProfile }));
        }
      } else {
        showError(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Failed to process your query');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuery = (query: string) => {
    setInput(query);
    setTimeout(() => handleSend(), 100);
  };

  const handleReset = () => {
    setMessages([messages[0]]);
    setUserProfile({ rank: null, category: 'GENERAL', state: '', budget: null });
    showSuccess('Conversation reset');
  };

  const handleExport = () => {
    const transcript = messages
      .map(m => `${m.role.toUpperCase()} (${m.timestamp.toLocaleTimeString()}):\n${m.content}\n`)
      .join('\n---\n\n');

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neetlogiq-prediction-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Conversation exported');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Smart Predictor</h1>
              <p className="text-sm text-white/80">AI-powered college recommendations</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Export conversation"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* User Profile Display */}
        {(userProfile.rank || userProfile.state) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {userProfile.rank && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-xl rounded-full text-sm">
                Rank: {userProfile.rank.toLocaleString()}
              </span>
            )}
            {userProfile.category && userProfile.category !== 'GENERAL' && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-xl rounded-full text-sm">
                Category: {userProfile.category}
              </span>
            )}
            {userProfile.state && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-xl rounded-full text-sm">
                State: {userProfile.state}
              </span>
            )}
            {userProfile.budget && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-xl rounded-full text-sm">
                Budget: ₹{(userProfile.budget / 100000).toFixed(1)}L
              </span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="flex-shrink-0 px-6 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          <QuickActionButton
            icon={<TrendingUp className="h-4 w-4" />}
            label="Predict for rank 5000"
            onClick={() => handleQuickQuery('What are my chances with NEET rank 5000?')}
          />
          <QuickActionButton
            icon={<BookOpen className="h-4 w-4" />}
            label="Affordable colleges"
            onClick={() => handleQuickQuery('Show me government colleges under 5 lakh fees')}
          />
          <QuickActionButton
            icon={<Zap className="h-4 w-4" />}
            label="Top NIRF colleges"
            onClick={() => handleQuickQuery('List top 10 colleges by NIRF rank')}
          />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
        <div className="flex items-end space-x-4">
          <div className="flex-1">
            <textarea
              ref={inputRef as any}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything... (e.g., 'What are my chances with rank 5000?')"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white resize-none"
              rows={2}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <ShareButtons
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title="NEETLogiq Smart Predictor - My College Predictions"
              description="Check out my personalized college predictions from NEETLogiq"
            />
            <button
              onClick={() => setShowShareModal(false)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-2xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {message.content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-gradient-to-br from-green-500 to-teal-600'
          : 'bg-gradient-to-br from-blue-600 to-purple-600'
      }`}>
        {isUser ? (
          <User className="h-5 w-5 text-white" />
        ) : (
          <Bot className="h-5 w-5 text-white" />
        )}
      </div>

      <div className={`flex-1 max-w-3xl ${isUser ? 'flex justify-end' : ''}`}>
        <div className={`rounded-2xl p-4 border ${
          isUser
            ? 'bg-gradient-to-br from-green-500 to-teal-600 text-white border-green-600 rounded-tr-none'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 rounded-tl-none'
        }`}>
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>

          {/* Render structured data */}
          {message.data && message.data.predictions && (
            <PredictionCards predictions={message.data.predictions} />
          )}

          <div className={`mt-2 text-xs ${isUser ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

const PredictionCards: React.FC<{ predictions: Prediction[] }> = ({ predictions }) => {
  return (
    <div className="mt-4 space-y-3">
      {predictions.map((pred, index) => (
        <div
          key={index}
          className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4"
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">{pred.college}</h4>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              pred.category === 'safe'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : pred.category === 'moderate'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {pred.category.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-32">
                <div
                  className={`h-2 rounded-full ${
                    pred.probability >= 70
                      ? 'bg-green-600'
                      : pred.probability >= 40
                      ? 'bg-yellow-600'
                      : 'bg-red-600'
                  }`}
                  style={{ width: `${pred.probability}%` }}
                />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">{pred.probability}%</span>
            </div>

            {pred.cutoff && (
              <span className="text-gray-600 dark:text-gray-400">
                Cutoff: {pred.cutoff.toLocaleString()}
              </span>
            )}
          </div>

          {pred.reasoning && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{pred.reasoning}</p>
          )}
        </div>
      ))}
    </div>
  );
};

const QuickActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

export default SmartChat;
