#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

interface GitHubSolution {
  name: string;
  repo: string;
  description: string;
  technology: string;
  features: string[];
  setupCommand?: string;
}

class ParquetWebEditorSetup {
  private githubSolutions: GitHubSolution[] = [
    {
      name: "Payerset Parquet Editor",
      repo: "https://github.com/Payerset/parquet-editor",
      description: "GUI for editing Parquet files using DuckDB",
      technology: "Node.js + Python",
      features: [
        "Search and filter Parquet files",
        "Update records locally or on S3",
        "DuckDB integration",
        "Web-based interface"
      ],
      setupCommand: "git clone https://github.com/Payerset/parquet-editor.git"
    },
    {
      name: "ParquetEditor (Java)",
      repo: "https://github.com/kpmatta/ParquetEditor", 
      description: "Load and edit small Parquet files",
      technology: "Java + Gradle",
      features: [
        "Convert Parquet to JSON for editing",
        "Save changes back to Parquet",
        "Schema generation",
        "Desktop application"
      ],
      setupCommand: "git clone https://github.com/kpmatta/ParquetEditor.git"
    },
    {
      name: "Parquet Tools",
      repo: "https://github.com/hangxie/parquet-tools",
      description: "Command-line utility for Parquet operations",
      technology: "Go",
      features: [
        "View metadata and schema",
        "Count rows and cat data", 
        "Support for S3, GCS, Azure",
        "Command-line interface"
      ],
      setupCommand: "go install github.com/hangxie/parquet-tools@latest"
    }
  ];

  async displayOptions(): Promise<void> {
    console.log('🗄️ PARQUET WEB EDITOR SETUP OPTIONS');
    console.log('===================================');
    
    console.log('\n🎯 OPTION 1: Custom Next.js Editor (Built for You)');
    console.log('✅ Already created at: http://localhost:3500/parquet-database-editor');
    console.log('Features:');
    console.log('  - 📊 Web-based interface');
    console.log('  - ✏️ Direct cell editing');
    console.log('  - 🔍 Search and filtering');
    console.log('  - 💾 Save changes to Parquet files');
    console.log('  - 📄 Pagination for large datasets');
    console.log('  - 🔄 Real-time change tracking');

    console.log('\n🌐 OPTION 2: Online Parquet Editor');
    console.log('🔗 URL: https://www.parqueteditor.com/');
    console.log('Features:');
    console.log('  - 🌍 No installation required');
    console.log('  - 🔒 Client-side processing (secure)');
    console.log('  - ✏️ Schema and data editing');
    console.log('  - 💾 Download modified files');

    console.log('\n📦 OPTION 3: Open Source GitHub Solutions');
    this.githubSolutions.forEach((solution, index) => {
      console.log(`\n${index + 1}. ${solution.name}`);
      console.log(`   📍 Repository: ${solution.repo}`);
      console.log(`   🛠️  Technology: ${solution.technology}`);
      console.log(`   📖 Description: ${solution.description}`);
      console.log(`   ✨ Features:`);
      solution.features.forEach(feature => {
        console.log(`      - ${feature}`);
      });
      if (solution.setupCommand) {
        console.log(`   🚀 Setup: ${solution.setupCommand}`);
      }
    });
  }

  async setupCustomEditor(): Promise<void> {
    console.log('\n🔧 SETTING UP CUSTOM PARQUET EDITOR');
    console.log('===================================');
    
    // Check if our custom editor is accessible
    try {
      console.log('📍 Custom editor available at: http://localhost:3500/parquet-database-editor');
      console.log('📍 Unmatched data viewer at: http://localhost:3500/parquet-editor');
      
      // Test if the development server is running
      const response = await fetch('http://localhost:3500/api/parquet/database-editor?table=colleges&page=1&limit=5')
        .catch(() => null);
        
      if (response && response.ok) {
        console.log('✅ API endpoint is working');
        console.log('✅ Ready to edit Parquet files via web interface');
      } else {
        console.log('⚠️  Development server might not be running');
        console.log('   Run: npm run dev');
      }
      
    } catch (error) {
      console.log('❌ Error checking custom editor:', error);
    }
  }

  async installGitHubSolution(solutionIndex: number): Promise<void> {
    if (solutionIndex < 0 || solutionIndex >= this.githubSolutions.length) {
      throw new Error('Invalid solution index');
    }

    const solution = this.githubSolutions[solutionIndex];
    console.log(`\n🚀 INSTALLING ${solution.name.toUpperCase()}`);
    console.log('=' + '='.repeat(solution.name.length + 12));

    const installDir = path.join(process.cwd(), 'external-editors', solution.name.toLowerCase().replace(/\s+/g, '-'));
    
    // Create directory
    fs.mkdirSync(path.dirname(installDir), { recursive: true });
    
    if (solution.setupCommand) {
      console.log(`📥 Running: ${solution.setupCommand}`);
      
      await new Promise<void>((resolve, reject) => {
        const [command, ...args] = solution.setupCommand!.split(' ');
        const process = spawn(command, args, {
          cwd: path.dirname(installDir),
          stdio: 'inherit'
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Installation failed with code ${code}`));
          }
        });
      });

      console.log(`✅ ${solution.name} installed in: ${installDir}`);
      console.log('📖 Check the repository README for usage instructions');
    }
  }

  async createDuckDBWebInterface(): Promise<void> {
    console.log('\n🦆 CREATING DUCKDB WEB INTERFACE');
    console.log('================================');

    const duckdbInterfaceCode = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DuckDB Parquet Editor</title>
    <script src="https://unpkg.com/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-mvp.worker.js"></script>
    <script src="https://unpkg.com/@duckdb/duckdb-wasm@latest/dist/duckdb-mvp.wasm"></script>
    <script src="https://unpkg.com/@duckdb/duckdb-wasm@latest/dist/duckdb-browser.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        textarea { width: 100%; height: 100px; margin: 10px 0; }
        button { padding: 10px 20px; margin: 5px; background: #007cba; color: white; border: none; border-radius: 3px; cursor: pointer; }
        button:hover { background: #005a87; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .status { padding: 10px; margin: 10px 0; border-radius: 3px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🦆 DuckDB Parquet Editor</h1>
        <p>Edit Parquet files directly in your browser using DuckDB WASM</p>
        
        <div class="section">
            <h2>📁 Load Parquet File</h2>
            <input type="file" id="fileInput" accept=".parquet" />
            <button onclick="loadFile()">Load File</button>
            <div id="loadStatus"></div>
        </div>

        <div class="section">
            <h2>🔍 Query Data</h2>
            <textarea id="sqlQuery" placeholder="SELECT * FROM parquet_data LIMIT 10;"></textarea>
            <button onclick="executeQuery()">Execute Query</button>
            <div id="queryResults"></div>
        </div>

        <div class="section">
            <h2>✏️ Update Data</h2>
            <textarea id="updateQuery" placeholder="UPDATE parquet_data SET column_name = 'new_value' WHERE condition;"></textarea>
            <button onclick="executeUpdate()">Execute Update</button>
            <div id="updateStatus"></div>
        </div>

        <div class="section">
            <h2>💾 Export Data</h2>
            <button onclick="exportData()">Download Modified Parquet</button>
        </div>
    </div>

    <script>
        let db = null;
        let conn = null;

        async function initDuckDB() {
            const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
            const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
            const worker = new Worker(bundle.mainWorker);
            const logger = new duckdb.ConsoleLogger();
            db = new duckdb.AsyncDuckDB(logger, worker);
            await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            conn = await db.connect();
            console.log('DuckDB initialized');
        }

        async function loadFile() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (!file) {
                showStatus('loadStatus', 'Please select a file', 'error');
                return;
            }

            try {
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                await db.registerFileBuffer(file.name, uint8Array);
                await conn.query(\`CREATE OR REPLACE TABLE parquet_data AS SELECT * FROM '\${file.name}'\`);
                
                const result = await conn.query('SELECT COUNT(*) as count FROM parquet_data');
                const count = result.toArray()[0].count;
                
                showStatus('loadStatus', \`Successfully loaded \${count} records from \${file.name}\`, 'success');
                
                // Show first few rows
                document.getElementById('sqlQuery').value = 'SELECT * FROM parquet_data LIMIT 10;';
                executeQuery();
                
            } catch (error) {
                showStatus('loadStatus', \`Error loading file: \${error.message}\`, 'error');
            }
        }

        async function executeQuery() {
            const query = document.getElementById('sqlQuery').value;
            
            try {
                const result = await conn.query(query);
                const data = result.toArray();
                displayTable('queryResults', data);
            } catch (error) {
                showStatus('queryResults', \`Query error: \${error.message}\`, 'error');
            }
        }

        async function executeUpdate() {
            const query = document.getElementById('updateQuery').value;
            
            try {
                await conn.query(query);
                showStatus('updateStatus', 'Update executed successfully', 'success');
            } catch (error) {
                showStatus('updateStatus', \`Update error: \${error.message}\`, 'error');
            }
        }

        function displayTable(containerId, data) {
            const container = document.getElementById(containerId);
            
            if (!data || data.length === 0) {
                container.innerHTML = '<p>No data to display</p>';
                return;
            }

            const columns = Object.keys(data[0]);
            let html = '<table><thead><tr>';
            columns.forEach(col => html += \`<th>\${col}</th>\`);
            html += '</tr></thead><tbody>';
            
            data.forEach(row => {
                html += '<tr>';
                columns.forEach(col => html += \`<td>\${row[col] || ''}</td>\`);
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            container.innerHTML = html;
        }

        function showStatus(containerId, message, type) {
            const container = document.getElementById(containerId);
            container.innerHTML = \`<div class="status \${type}">\${message}</div>\`;
        }

        async function exportData() {
            try {
                // This would require additional implementation to export back to Parquet
                showStatus('updateStatus', 'Export functionality coming soon!', 'success');
            } catch (error) {
                showStatus('updateStatus', \`Export error: \${error.message}\`, 'error');
            }
        }

        // Initialize DuckDB when page loads
        initDuckDB();
    </script>
</body>
</html>
`;

    const duckdbPath = path.join(process.cwd(), 'public', 'duckdb-editor.html');
    fs.writeFileSync(duckdbPath, duckdbInterfaceCode);
    
    console.log(`✅ DuckDB web interface created at: ${duckdbPath}`);
    console.log('🌐 Access at: http://localhost:3500/duckdb-editor.html');
    console.log('🦆 Uses DuckDB WASM for client-side Parquet editing');
  }

  async generateComparisonReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), 'data', 'parquet-editor-comparison.md');
    
    const report = `# 🗄️ Parquet Editor Solutions Comparison

## 🎯 Quick Recommendation

**For your use case (editing counselling data):**
1. **BEST**: Custom Next.js Editor (http://localhost:3500/parquet-database-editor)
2. **BACKUP**: Online Editor (https://www.parqueteditor.com/)
3. **ADVANCED**: DuckDB Web Interface (http://localhost:3500/duckdb-editor.html)

---

## 📊 Detailed Comparison

| Solution | Technology | Pros | Cons | Best For |
|----------|------------|------|------|----------|
| **Custom Next.js Editor** | TypeScript/React | ✅ Integrated with your app<br>✅ Direct file editing<br>✅ Search/filter<br>✅ Change tracking | ❌ Limited to your localhost | Your specific workflow |
| **Online Parquet Editor** | Web-based | ✅ No installation<br>✅ Secure (client-side)<br>✅ Schema editing | ❌ File upload required<br>❌ Not integrated | Quick one-off edits |
| **Payerset Editor** | Node.js/Python | ✅ Professional tool<br>✅ S3 support<br>✅ DuckDB backend | ❌ Setup required<br>❌ Learning curve | Production environments |
| **DuckDB WASM** | Browser-based | ✅ SQL interface<br>✅ Powerful queries<br>✅ No server needed | ❌ Complex for simple edits<br>❌ Limited UI | SQL power users |

---

## 🚀 Setup Instructions

### Option 1: Use Your Custom Editor (RECOMMENDED)
\`\`\`bash
# Already set up! Just visit:
http://localhost:3500/parquet-database-editor

# Features:
# ✅ Edit colleges, programs, cutoffs, seat_data
# ✅ Search and filter records  
# ✅ Direct cell editing
# ✅ Save changes to Parquet files
# ✅ Change tracking and undo
\`\`\`

### Option 2: Online Editor
\`\`\`bash
# No setup needed
# 1. Go to: https://www.parqueteditor.com/
# 2. Upload your Parquet file
# 3. Edit data and schema
# 4. Download modified file
\`\`\`

### Option 3: Install Payerset Editor
\`\`\`bash
git clone https://github.com/Payerset/parquet-editor
cd parquet-editor
npm install
# Follow their README for setup
\`\`\`

### Option 4: Use DuckDB Web Interface
\`\`\`bash
# Already created for you!
http://localhost:3500/duckdb-editor.html

# SQL-based editing:
# SELECT * FROM parquet_data WHERE college LIKE '%SMS%';
# UPDATE parquet_data SET college = 'SAWAI MAN SINGH MEDICAL COLLEGE' WHERE college = 'SMS MEDICAL COLLEGE';
\`\`\`

---

## 💡 For Your Counselling Data Editing

**Recommended Workflow:**
1. **🌐 Use Custom Editor**: http://localhost:3500/parquet-database-editor
2. **📊 Select 'colleges' table** to edit college names
3. **🔍 Search for 'SMS MEDICAL'** to find problematic entries
4. **✏️ Click cells** to edit directly: \`SMS MEDICAL COLLEGE\` → \`SAWAI MAN SINGH MEDICAL COLLEGE\`
5. **💾 Save changes** - automatically updates the Parquet file
6. **🔄 Re-run import** to see improved matching rates

**Benefits:**
- ✅ **No file uploads** - works directly with your local files
- ✅ **Integrated workflow** - part of your existing system
- ✅ **Change tracking** - see exactly what you've modified
- ✅ **Backup creation** - automatic backups before saves
- ✅ **Real-time updates** - changes reflect immediately

---

*Generated on ${new Date().toLocaleString()}*
`;

    fs.writeFileSync(reportPath, report);
    console.log(`📋 Comparison report created: ${reportPath}`);
  }
}

async function main() {
  const setup = new ParquetWebEditorSetup();
  
  try {
    await setup.displayOptions();
    await setup.setupCustomEditor();
    await setup.createDuckDBWebInterface();
    await setup.generateComparisonReport();
    
    console.log('\n🎉 PARQUET WEB EDITOR SETUP COMPLETE!');
    console.log('====================================');
    console.log('');
    console.log('🎯 RECOMMENDED: Use your custom editor');
    console.log('🌐 URL: http://localhost:3500/parquet-database-editor');
    console.log('');
    console.log('📋 Full comparison report: data/parquet-editor-comparison.md');
    console.log('🦆 DuckDB interface: http://localhost:3500/duckdb-editor.html');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { ParquetWebEditorSetup };
