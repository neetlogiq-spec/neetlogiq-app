import { Metadata } from 'next';
import SmartChat from '@/components/smart/SmartChat';
import Breadcrumb from '@/components/ui/Breadcrumb';

export const metadata: Metadata = {
  title: 'Smart Predictor - AI-Powered College Recommendations | NEETLogiq',
  description: 'Get personalized college predictions using AI. Ask in natural language and get probability-based recommendations for NEET admissions.',
  keywords: 'NEET predictor, college predictor, AI college recommendations, admission probability, NEET rank predictor',
};

export default function SmartPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <Breadcrumb items={[{ label: 'Smart Predictor', href: '/smart' }]} />

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Smart College Predictor 🤖
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Ask questions in natural language and get AI-powered college recommendations
            with probability calculations based on historical data.
          </p>
        </div>

        {/* Chat Interface */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden h-[calc(100vh-280px)] min-h-[600px]">
          <SmartChat />
        </div>

        {/* Features Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            title="Natural Language"
            description="Ask in plain English like 'What are my chances with rank 5000?'"
            icon="💬"
            gradient="from-blue-500 to-cyan-500"
          />
          <FeatureCard
            title="Probability Based"
            description="Get Safe/Moderate/Reach categories with exact percentages"
            icon="📊"
            gradient="from-purple-500 to-pink-500"
          />
          <FeatureCard
            title="Context Aware"
            description="Remembers your rank, category, and preferences throughout the chat"
            icon="🧠"
            gradient="from-green-500 to-teal-500"
          />
        </div>

        {/* Example Queries */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ✨ Try these example queries:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ExampleQuery text="What are my chances with NEET rank 5000?" />
            <ExampleQuery text="Show me colleges for OBC category with rank under 10000" />
            <ExampleQuery text="List government colleges in Delhi under 5 lakh fees" />
            <ExampleQuery text="Compare AIIMS Delhi vs Maulana Azad Medical College" />
            <ExampleQuery text="Which colleges have cutoff less than 2000?" />
            <ExampleQuery text="Best ROI colleges for NEET rank 15000" />
          </div>
        </div>
      </div>
    </div>
  );
}

const FeatureCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  gradient: string;
}> = ({ title, description, icon, gradient }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
      <div className={`inline-flex p-3 bg-gradient-to-br ${gradient} rounded-xl mb-4`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
};

const ExampleQuery: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
      <span className="text-blue-600 dark:text-blue-400">→</span>
      <span>{text}</span>
    </div>
  );
};
