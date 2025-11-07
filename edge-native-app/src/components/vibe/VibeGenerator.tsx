/**
 * VibeSDK Generator Component
 * UI for generating AI-powered applications
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Code, Eye, ExternalLink, Copy, Download } from 'lucide-react';
import { VibeGenerationRequest, VibeGenerationResponse } from '@/types/cloudflare';

interface VibeGeneratorProps {
  onGenerate?: (response: VibeGenerationResponse) => void;
  className?: string;
}

export function VibeGenerator({ onGenerate, className }: VibeGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedApp, setGeneratedApp] = useState<VibeGenerationResponse | null>(null);
  const [formData, setFormData] = useState<VibeGenerationRequest>({
    prompt: '',
    framework: 'nextjs',
    features: ['typescript', 'tailwind'],
    style: 'production',
    includeTests: true,
    includeDocumentation: true
  });

  const handleGenerate = async () => {
    if (!formData.prompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/vibe/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (result.success) {
        setGeneratedApp(result.data);
        onGenerate?.(result.data);
      } else {
        console.error('Generation failed:', result.error);
      }
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedApp?.code) {
      navigator.clipboard.writeText(generatedApp.code);
    }
  };

  const handleDownloadCode = () => {
    if (generatedApp?.code) {
      const blob = new Blob([generatedApp.code], { type: 'text/typescript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedApp.app.name.replace(/\s+/g, '-').toLowerCase()}.tsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            AI Code Generator
          </CardTitle>
          <CardDescription>
            Generate AI-powered applications using Cloudflare VibeSDK
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Describe what you want to build
            </label>
            <Textarea
              placeholder="e.g., Create a medical college finder with search, filters, and comparison features..."
              value={formData.prompt}
              onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
              rows={4}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Framework</label>
              <Select
                value={formData.framework}
                onValueChange={(value) => setFormData(prev => ({ ...prev, framework: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nextjs">Next.js</SelectItem>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="vue">Vue.js</SelectItem>
                  <SelectItem value="svelte">Svelte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Style</label>
              <Select
                value={formData.style}
                onValueChange={(value) => setFormData(prev => ({ ...prev, style: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Features</label>
            <div className="flex flex-wrap gap-2">
              {['typescript', 'tailwind', 'responsive', 'accessibility', 'testing', 'documentation'].map((feature) => (
                <Badge
                  key={feature}
                  variant={formData.features?.includes(feature) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    const currentFeatures = formData.features || [];
                    const newFeatures = currentFeatures.includes(feature)
                      ? currentFeatures.filter(f => f !== feature)
                      : [...currentFeatures, feature];
                    setFormData(prev => ({ ...prev, features: newFeatures }));
                  }}
                >
                  {feature}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeTests"
                checked={formData.includeTests}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includeTests: !!checked }))}
              />
              <label htmlFor="includeTests" className="text-sm">Include Tests</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeDocumentation"
                checked={formData.includeDocumentation}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includeDocumentation: !!checked }))}
              />
              <label htmlFor="includeDocumentation" className="text-sm">Include Documentation</label>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!formData.prompt.trim() || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Code className="h-4 w-4 mr-2" />
                Generate App
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated App */}
      {generatedApp && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {generatedApp.app.name}
                </CardTitle>
                <CardDescription>
                  {generatedApp.app.description}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCode}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* App Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Framework:</span>
                <Badge variant="secondary" className="ml-2">
                  {generatedApp.app.framework}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <Badge variant="outline" className="ml-2">
                  {generatedApp.app.status}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Stars:</span>
                <span className="ml-2">{generatedApp.app.stars}</span>
              </div>
              <div>
                <span className="font-medium">Forks:</span>
                <span className="ml-2">{generatedApp.app.forks}</span>
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-4">
              {generatedApp.previewUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(generatedApp.previewUrl, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              )}
              {generatedApp.deploymentUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(generatedApp.deploymentUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Deploy
                </Button>
              )}
            </div>

            {/* Generated Code */}
            <div>
              <label className="text-sm font-medium mb-2 block">Generated Code</label>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{generatedApp.code}</code>
              </pre>
            </div>

            {/* Metadata */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div>Tokens Used: {generatedApp.metadata.tokensUsed}</div>
              <div>Model: {generatedApp.metadata.model}</div>
              <div>Generation Time: {generatedApp.metadata.generationTime}ms</div>
              <div>Confidence: {(generatedApp.metadata.confidence * 100).toFixed(1)}%</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
