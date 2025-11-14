/**
 * Cloudflare Worker: R2 Upload Trigger
 *
 * This worker automatically triggers when new Parquet files are uploaded to R2.
 * It regenerates the manifest, invalidates caches, and triggers deployment.
 *
 * Setup:
 * 1. Deploy this worker to Cloudflare
 * 2. Configure R2 bucket notification to trigger this worker
 * 3. Set environment variables: GITHUB_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

export default {
  /**
   * Triggered by R2 bucket notification when files are uploaded
   */
  async fetch(request, env) {
    if (request.method === 'POST') {
      return this.handleR2Upload(request, env);
    }

    // Health check endpoint
    return new Response('R2 Upload Trigger Active', { status: 200 });
  },

  /**
   * Handle R2 upload notification
   */
  async handleR2Upload(request, env) {
    try {
      const uploadData = await request.json();
      console.log('R2 Upload detected:', uploadData);

      const steps = [];

      // Step 1: Analyze uploaded files
      steps.push(await this.analyzeUploadedFiles(uploadData, env));

      // Step 2: Generate new manifest
      steps.push(await this.generateManifest(env));

      // Step 3: Invalidate caches
      steps.push(await this.invalidateCaches(env));

      // Step 4: Trigger GitHub Actions deployment
      steps.push(await this.triggerDeployment(env));

      // Step 5: Send success notification
      await this.sendNotification(env, {
        type: 'SUCCESS',
        title: '✅ Data Update Complete',
        steps: steps,
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify({
        success: true,
        steps: steps,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('R2 Upload processing failed:', error);

      await this.sendNotification(env, {
        type: 'ERROR',
        title: '❌ Data Update Failed',
        error: error.message,
        stack: error.stack
      });

      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Analyze uploaded Parquet files
   */
  async analyzeUploadedFiles(uploadData, env) {
    const files = uploadData.objects || [];
    const analysis = {
      totalFiles: files.length,
      fileTypes: {},
      streams: new Set(),
      years: new Set()
    };

    for (const file of files) {
      // Extract metadata from filename
      // Format: {stream}_{year}_R{round}.parquet
      const match = file.key.match(/([A-Z_]+)_(\d{4})_R(\d+)\.parquet$/);

      if (match) {
        const [, stream, year, round] = match;
        analysis.streams.add(stream);
        analysis.years.add(parseInt(year));

        if (!analysis.fileTypes[stream]) {
          analysis.fileTypes[stream] = [];
        }
        analysis.fileTypes[stream].push({ year: parseInt(year), round: parseInt(round) });
      }
    }

    return {
      step: 'File Analysis',
      status: 'completed',
      data: {
        ...analysis,
        streams: Array.from(analysis.streams),
        years: Array.from(analysis.years).sort((a, b) => b - a)
      }
    };
  },

  /**
   * Generate updated manifest.json
   */
  async generateManifest(env) {
    // List all Parquet files in R2
    const parquetFiles = await env.R2_BUCKET.list({ prefix: 'data/parquet/' });

    const manifest = {
      version: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      lastUpdated: new Date().toISOString(),
      dataHash: this.generateDataHash(parquetFiles.objects),
      streams: {},
      metadata: {
        totalFiles: parquetFiles.objects.length,
        totalSize: parquetFiles.objects.reduce((sum, obj) => sum + obj.size, 0)
      }
    };

    // Parse Parquet files and build manifest
    for (const file of parquetFiles.objects) {
      const match = file.key.match(/([A-Z_]+)_(\d{4})_R(\d+)\.parquet$/);

      if (match) {
        const [, stream, year, round] = match;

        if (!manifest.streams[stream]) {
          manifest.streams[stream] = {
            years: new Set(),
            rounds: new Set(),
            files: []
          };
        }

        manifest.streams[stream].years.add(parseInt(year));
        manifest.streams[stream].rounds.add(parseInt(round));
        manifest.streams[stream].files.push({
          filename: file.key,
          year: parseInt(year),
          round: parseInt(round),
          size: file.size,
          uploaded: file.uploaded
        });
      }
    }

    // Convert Sets to sorted Arrays
    for (const stream in manifest.streams) {
      manifest.streams[stream].years = Array.from(manifest.streams[stream].years).sort((a, b) => b - a);
      manifest.streams[stream].rounds = Array.from(manifest.streams[stream].rounds).sort();
      delete manifest.streams[stream].files; // Remove file details from public manifest
    }

    // Store manifest in R2
    await env.R2_BUCKET.put(
      'data/manifest.json',
      JSON.stringify(manifest, null, 2),
      {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=300' // 5 minutes
        }
      }
    );

    // Also store in KV for faster access
    await env.KV_NAMESPACE.put('data:manifest', JSON.stringify(manifest), {
      expirationTtl: 3600 // 1 hour
    });

    return {
      step: 'Manifest Generation',
      status: 'completed',
      data: {
        version: manifest.version,
        streams: Object.keys(manifest.streams),
        totalFiles: manifest.metadata.totalFiles
      }
    };
  },

  /**
   * Generate hash for cache invalidation
   */
  generateDataHash(objects) {
    const data = objects
      .map(obj => `${obj.key}:${obj.size}:${obj.uploaded}`)
      .sort()
      .join('|');

    return this.simpleHash(data);
  },

  /**
   * Simple hash function (DJB2 algorithm)
   */
  simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  },

  /**
   * Invalidate all cache layers
   */
  async invalidateCaches(env) {
    const cacheKeys = [
      'cutoffs:*',
      'colleges:*',
      'courses:*',
      'search:*',
      'analytics:*'
    ];

    let invalidatedCount = 0;

    // Invalidate KV cache
    for (const pattern of cacheKeys) {
      const keys = await env.KV_NAMESPACE.list({ prefix: pattern.replace('*', '') });

      for (const key of keys.keys) {
        await env.KV_NAMESPACE.delete(key.name);
        invalidatedCount++;
      }
    }

    // Increment version number to invalidate CDN/browser caches
    const currentVersion = await env.KV_NAMESPACE.get('cache:version') || '1';
    const newVersion = (parseInt(currentVersion) + 1).toString();
    await env.KV_NAMESPACE.put('cache:version', newVersion);

    return {
      step: 'Cache Invalidation',
      status: 'completed',
      data: {
        invalidatedKeys: invalidatedCount,
        newCacheVersion: newVersion
      }
    };
  },

  /**
   * Trigger GitHub Actions deployment
   */
  async triggerDeployment(env) {
    if (!env.GITHUB_TOKEN) {
      return {
        step: 'Deployment Trigger',
        status: 'skipped',
        reason: 'GITHUB_TOKEN not configured'
      };
    }

    // Trigger GitHub Actions workflow
    const response = await fetch(
      'https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            trigger: 'r2-upload',
            timestamp: new Date().toISOString()
          }
        })
      }
    );

    if (response.ok) {
      return {
        step: 'Deployment Trigger',
        status: 'completed',
        data: {
          workflow: 'deploy.yml',
          triggered: true
        }
      };
    } else {
      throw new Error(`GitHub Actions trigger failed: ${response.statusText}`);
    }
  },

  /**
   * Send notification (Telegram + Email)
   */
  async sendNotification(env, notification) {
    const notifications = [];

    // Telegram notification
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const message = this.formatTelegramMessage(notification);

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
          })
        }
      );

      notifications.push({
        channel: 'telegram',
        success: telegramResponse.ok
      });
    }

    // Email notification (Cloudflare Email Workers)
    if (env.EMAIL_RECIPIENT) {
      // TODO: Implement email notification
      // This requires Cloudflare Email Workers setup
    }

    return notifications;
  },

  /**
   * Format notification message for Telegram
   */
  formatTelegramMessage(notification) {
    if (notification.type === 'SUCCESS') {
      let message = `${notification.title}\n\n`;

      for (const step of notification.steps) {
        message += `✅ *${step.step}*: ${step.status}\n`;
        if (step.data) {
          message += `   Details: ${JSON.stringify(step.data, null, 2)}\n`;
        }
      }

      message += `\n🕐 Time: ${notification.timestamp}`;
      return message;
    } else {
      return `${notification.title}\n\n` +
             `Error: ${notification.error}\n\n` +
             `Please check the logs for details.`;
    }
  }
};
