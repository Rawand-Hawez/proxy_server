const express = require('express');
const path = require('path');

class WebInterface {
  constructor(databaseService, adminToken) {
    this.db = databaseService;
    this.adminToken = adminToken;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Simple authentication middleware
    this.app.use((req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token !== this.adminToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });
  }

  setupRoutes() {
    // Dashboard - Main interface
    this.app.get('/admin', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Proxy Server Admin</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: #333; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .nav { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .nav button { margin-right: 10px; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
            .btn-primary { background: #007bff; color: white; }
            .btn-success { background: #28a745; color: white; }
            .btn-info { background: #17a2b8; color: white; }
            .btn-danger { background: #dc3545; color: white; }
            .content { background: white; padding: 20px; border-radius: 8px; min-height: 400px; }
            .form-group { margin-bottom: 15px; }
            .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
            .form-group input, .form-group textarea, .form-group select { 
              width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; 
            }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; }
            .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; }
            .status-active { background: #d4edda; color: #155724; }
            .status-inactive { background: #f8d7da; color: #721c24; }
            .hidden { display: none; }
            .alert { padding: 15px; margin-bottom: 20px; border-radius: 4px; }
            .alert-success { background-color: #d4edda; border-color: #c3e6cb; color: #155724; }
            .alert-danger { background-color: #f8d7da; border-color: #f5c6cb; color: #721c24; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏗️ Proxy Server Admin Dashboard</h1>
              <p>Manage your proxy server, cache, and database records</p>
            </div>
            
            <div class="nav">
              <button class="btn-primary" onclick="showSection('dashboard')">📊 Dashboard</button>
              <button class="btn-success" onclick="showSection('custom-data')">📝 Custom Data</button>
              <button class="btn-info" onclick="showSection('cache-stats')">🗃️ Cache Stats</button>
              <button class="btn-info" onclick="showSection('api-logs')">📋 API Logs</button>
              <button class="btn-info" onclick="showSection('config')">⚙️ Configuration</button>
            </div>

            <!-- Dashboard Section -->
            <div id="dashboard" class="content">
              <h2>System Overview</h2>
              <div id="dashboard-stats">Loading...</div>
            </div>

            <!-- Custom Data Section -->
            <div id="custom-data" class="content hidden">
              <h2>Custom Data Management</h2>
              <button class="btn-success" onclick="showAddForm()">➕ Add New Record</button>
              
              <!-- Add Record Form -->
              <div id="add-form" class="hidden" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Add New Record</h3>
                <form id="record-form">
                  <div class="form-group">
                    <label>Table Name:</label>
                    <input type="text" id="table-name" placeholder="e.g., products, customers" required>
                  </div>
                  <div class="form-group">
                    <label>Record Data (JSON):</label>
                    <textarea id="record-data" rows="5" placeholder='{"name": "Product Name", "price": 99.99}' required></textarea>
                  </div>
                  <button type="submit" class="btn-success">💾 Save Record</button>
                  <button type="button" onclick="hideAddForm()" class="btn-danger">❌ Cancel</button>
                </form>
              </div>

              <!-- Records List -->
              <div id="records-list"></div>
            </div>

            <!-- Cache Stats Section -->
            <div id="cache-stats" class="content hidden">
              <h2>Cache Statistics</h2>
              <button onclick="loadCacheStats()" class="btn-info">🔄 Refresh</button>
              <div id="cache-data">Loading...</div>
            </div>

            <!-- API Logs Section -->
            <div id="api-logs" class="content hidden">
              <h2>API Logs</h2>
              <button onclick="loadApiLogs()" class="btn-info">🔄 Refresh</button>
              <div id="logs-data">Loading...</div>
            </div>

            <!-- Configuration Section -->
            <div id="config" class="content hidden">
              <h2>Application Configuration</h2>
              <button onclick="loadConfig()" class="btn-info">🔄 Refresh</button>
              <div id="config-data">Loading...</div>
            </div>
          </div>

          <script>
            const adminToken = '${this.adminToken}';
            
            function showSection(sectionId) {
              // Hide all sections
              document.querySelectorAll('.content').forEach(el => el.classList.add('hidden'));
              // Show selected section
              document.getElementById(sectionId).classList.remove('hidden');
              
              // Load data for section
              if (sectionId === 'dashboard') loadDashboard();
              if (sectionId === 'custom-data') loadCustomData();
              if (sectionId === 'cache-stats') loadCacheStats();
              if (sectionId === 'api-logs') loadApiLogs();
              if (sectionId === 'config') loadConfig();
            }

            async function apiCall(endpoint, options = {}) {
              try {
                const response = await fetch(endpoint, {
                  ...options,
                  headers: {
                    'Authorization': \`Bearer \${adminToken}\`,
                    'Content-Type': 'application/json',
                    ...options.headers
                  }
                });
                return await response.json();
              } catch (error) {
                console.error('API call failed:', error);
                return { error: error.message };
              }
            }

            async function loadDashboard() {
              const stats = await apiCall('/admin/stats');
              document.getElementById('dashboard-stats').innerHTML = \`
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                  <div style="background: #e3f2fd; padding: 20px; border-radius: 8px;">
                    <h3>🗃️ Database Records</h3>
                    <p>Cache Entries: \${stats.database?.api_cache || 0}</p>
                    <p>Custom Records: \${stats.database?.custom_data || 0}</p>
                    <p>API Logs: \${stats.database?.api_logs || 0}</p>
                  </div>
                  <div style="background: #f3e5f5; padding: 20px; border-radius: 8px;">
                    <h3>⚡ Cache Performance</h3>
                    <p>Hit Rate: \${stats.cache?.hit_rate || 'N/A'}</p>
                    <p>Total Operations: \${stats.cache?.total_ops || 0}</p>
                  </div>
                  <div style="background: #e8f5e8; padding: 20px; border-radius: 8px;">
                    <h3>🔧 System Health</h3>
                    <p>Redis: \${stats.redis?.connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
                    <p>Database: \${stats.database?.available ? '🟢 Available' : '🔴 Unavailable'}</p>
                  </div>
                </div>
              \`;
            }

            async function loadCustomData() {
              const data = await apiCall('/admin/custom-data');
              const recordsList = document.getElementById('records-list');
              
              if (data.records && data.records.length > 0) {
                recordsList.innerHTML = \`
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Table</th>
                        <th>Data</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      \${data.records.map(record => \`
                        <tr>
                          <td>\${record.id}</td>
                          <td>\${record.tableName}</td>
                          <td><pre style="margin: 0; font-size: 12px;">\${JSON.stringify(record.data, null, 2)}</pre></td>
                          <td>\${new Date(record.createdAt).toLocaleString()}</td>
                          <td>
                            <button onclick="deleteRecord(\${record.id})" class="btn-danger" style="padding: 5px 10px;">Delete</button>
                          </td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                \`;
              } else {
                recordsList.innerHTML = '<p>No records found. Add your first record above!</p>';
              }
            }

            async function loadCacheStats() {
              const data = await apiCall('/admin/cache/stats');
              document.getElementById('cache-data').innerHTML = \`
                <pre>\${JSON.stringify(data, null, 2)}</pre>
              \`;
            }

            async function loadApiLogs() {
              const data = await apiCall('/admin/logs');
              document.getElementById('logs-data').innerHTML = \`
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Endpoint</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${data.logs?.map(log => \`
                      <tr>
                        <td>\${new Date(log.created_at).toLocaleString()}</td>
                        <td>\${log.endpoint}</td>
                        <td>\${log.method}</td>
                        <td>\${log.status_code}</td>
                        <td>\${log.response_time_ms}ms</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              \`;
            }

            async function loadConfig() {
              const data = await apiCall('/admin/config');
              document.getElementById('config-data').innerHTML = \`
                <table>
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${data.configs?.map(config => \`
                      <tr>
                        <td>\${config.key}</td>
                        <td><pre style="margin: 0; font-size: 12px;">\${JSON.stringify(config.value, null, 2)}</pre></td>
                        <td>\${config.description || ''}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              \`;
            }

            function showAddForm() {
              document.getElementById('add-form').classList.remove('hidden');
            }

            function hideAddForm() {
              document.getElementById('add-form').classList.add('hidden');
              document.getElementById('record-form').reset();
            }

            document.getElementById('record-form').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const tableName = document.getElementById('table-name').value;
              const recordDataStr = document.getElementById('record-data').value;
              
              try {
                const recordData = JSON.parse(recordDataStr);
                const result = await apiCall('/admin/custom-data', {
                  method: 'POST',
                  body: JSON.stringify({ tableName, recordData })
                });
                
                if (result.success) {
                  alert('Record added successfully!');
                  hideAddForm();
                  loadCustomData();
                } else {
                  alert('Error: ' + result.error);
                }
              } catch (error) {
                alert('Invalid JSON data!');
              }
            });

            async function deleteRecord(id) {
              if (confirm('Are you sure you want to delete this record?')) {
                const result = await apiCall(\`/admin/custom-data/\${id}\`, { method: 'DELETE' });
                if (result.success) {
                  alert('Record deleted successfully!');
                  loadCustomData();
                } else {
                  alert('Error deleting record: ' + result.error);
                }
              }
            }

            // Load dashboard on page load
            window.onload = () => {
              showSection('dashboard');
            };
          </script>
        </body>
        </html>
      `);
    });

    // Custom Data Management API Routes
    this.app.get('/admin/custom-data', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const records = await this.db.getCustomRecords('*', limit, offset);
        
        res.json({
          success: true,
          records: records
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/admin/custom-data', async (req, res) => {
      try {
        const { tableName, recordData } = req.body;
        
        if (!tableName || !recordData) {
          return res.status(400).json({ success: false, error: 'Table name and record data are required' });
        }
        
        const id = await this.db.createCustomRecord(tableName, recordData);
        
        res.json({ success: true, id, message: 'Record created successfully' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/admin/custom-data/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await this.db.deleteCustomRecord(id);
        
        res.json({ 
          success: deleted, 
          message: deleted ? 'Record deleted successfully' : 'Record not found' 
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // System Statistics
    this.app.get('/admin/stats', async (req, res) => {
      try {
        const database = await this.db.getDatabaseStats();
        const cache = await this.db.getCacheStats?.() || { hit_rate: 'N/A', total_ops: 0 };
        
        res.json({
          success: true,
          database,
          cache,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Cache Statistics
    this.app.get('/admin/cache/stats', async (req, res) => {
      try {
        const stats = await this.db.getDatabaseStats();
        res.json({ success: true, stats });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API Logs
    this.app.get('/admin/logs', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await this.db.getApiLogs(limit);
        
        res.json({
          success: true,
          logs: logs
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Configuration
    this.app.get('/admin/config', async (req, res) => {
      try {
        const configs = await this.db.getAllConfigs();
        
        res.json({
          success: true,
          configs: configs
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  start(port = 3001) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`🌐 Web Admin Interface running on port ${port}`);
        console.log(`📱 Access at: http://localhost:${port}/admin`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('🛑 Web Admin Interface stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = WebInterface;