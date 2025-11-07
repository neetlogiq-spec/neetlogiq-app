/**
 * VibeSDK Integration Page
 * AI-powered application generation using Cloudflare VibeSDK
 */

import { VibeGenerator } from '@/components/vibe/VibeGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code, Zap, Globe, Shield, Rocket } from 'lucide-react';

export default function VibePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            AI-Powered Development with VibeSDK
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Generate full-stack applications from natural language prompts using Cloudflare's VibeSDK
          </p>
          <div className="flex justify-center gap-2">
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">Next.js</Badge>
            <Badge variant="secondary">Cloudflare Workers</Badge>
            <Badge variant="secondary">AI-Powered</Badge>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader className="text-center">
              <Code className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <CardTitle className="text-lg">AI Code Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Generate complete applications from natural language descriptions
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
              <CardTitle className="text-lg">Live Previews</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                See your generated apps in real-time with instant previews
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Globe className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <CardTitle className="text-lg">Global Deployment</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Deploy to Cloudflare's global edge network instantly
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <CardTitle className="text-lg">Secure & Isolated</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Each app runs in a secure, isolated environment
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* VibeSDK Generator */}
        <VibeGenerator />

        {/* Medical Education Examples */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Medical Education Examples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  College Finder
                </CardTitle>
                <CardDescription>
                  Search and compare medical colleges with advanced filters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  "Create a medical college finder with search, filters, and comparison features"
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Cutoff Analyzer
                </CardTitle>
                <CardDescription>
                  Analyze NEET cutoff trends and predict admission chances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  "Build a NEET cutoff analyzer with trend analysis and predictions"
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Course Planner
                </CardTitle>
                <CardDescription>
                  Plan your medical education journey with AI recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  "Create a course planner with AI recommendations and career guidance"
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Getting Started */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started with VibeSDK</CardTitle>
              <CardDescription>
                Learn how to use AI-powered development in your medical education projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">1. Describe Your App</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Use natural language to describe what you want to build. Be specific about features, styling, and functionality.
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">2. Choose Framework & Style</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select your preferred framework (Next.js, React, Vue, Svelte) and development style (minimal, comprehensive, production).
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">3. Generate & Preview</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Watch as AI generates your application code and creates a live preview for immediate testing.
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">4. Deploy & Share</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Deploy your app to Cloudflare's global edge network and share it with the world.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
