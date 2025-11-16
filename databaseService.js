const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor(dbPath = './data/proxy_server.db') {
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.dbPath = dbPath;
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // API Cache table for storing API responses
      `CREATE TABLE IF NOT EXISTS api_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        cache_key TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Local data storage for custom entries
      `CREATE TABLE IF NOT EXISTS custom_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // API logs for monitoring
      `CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER,
        response_time_ms INTEGER,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Configuration storage
      `CREATE TABLE IF NOT EXISTS app_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // User sessions (for web interface)
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        user_data TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Data sync logs
      `CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL,
        source_endpoint TEXT,
        records_processed INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Climate projects table
      `CREATE TABLE IF NOT EXISTS climate_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        amount INTEGER NOT NULL,
        unit TEXT NOT NULL,
        duration TEXT NOT NULL,
        status TEXT NOT NULL,
        location TEXT NOT NULL,
        partner TEXT NOT NULL,
        direct_beneficiary INTEGER NOT NULL DEFAULT 0,
        indirect_beneficiary INTEGER NOT NULL DEFAULT 0,
        environmental_outcome TEXT,
        brief TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Marketing projects table
      `CREATE TABLE IF NOT EXISTS marketing_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_key TEXT UNIQUE NOT NULL,
        project_name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Marketing metrics definitions
      `CREATE TABLE IF NOT EXISTS marketing_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        metric_key TEXT NOT NULL,
        metric_label TEXT NOT NULL,
        category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES marketing_projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, metric_key)
      )`,

      // Marketing daily data (time series)
      `CREATE TABLE IF NOT EXISTS marketing_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        metric_id INTEGER NOT NULL,
        date DATE NOT NULL,
        value REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES marketing_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (metric_id) REFERENCES marketing_metrics(id) ON DELETE CASCADE,
        UNIQUE(project_id, metric_id, date)
      )`
    ];

    try {
      for (const table of tables) {
        await this.runQuery(table);
      }
      console.log('Database tables created successfully');
      this.initialized = true;
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Cache operations
  async setCache(endpoint, cacheKey, data, ttlSeconds = 3600) {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const dataStr = JSON.stringify(data);
      
      await this.runQuery(
        `INSERT OR REPLACE INTO api_cache (endpoint, cache_key, data, expires_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [endpoint, cacheKey, dataStr, expiresAt]
      );
      
      console.log(`Cache set for ${endpoint}: ${cacheKey}`);
      return true;
    } catch (error) {
      console.error('Error setting cache:', error);
      return false;
    }
  }

  async getCache(cacheKey) {
    try {
      const result = await this.getQuery(
        `SELECT data, expires_at FROM api_cache 
         WHERE cache_key = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
        [cacheKey]
      );
      
      if (result) {
        return JSON.parse(result.data);
      }
      return null;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  async clearExpiredCache() {
    try {
      const result = await this.runQuery(
        `DELETE FROM api_cache WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`
      );
      console.log(`Cleared ${result.changes} expired cache entries`);
      return result.changes;
    } catch (error) {
      console.error('Error clearing expired cache:', error);
      return 0;
    }
  }

  // Custom data operations
  async createCustomRecord(tableName, recordData) {
    try {
      const dataStr = JSON.stringify(recordData);
      const result = await this.runQuery(
        `INSERT INTO custom_data (table_name, record_data, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [tableName, dataStr]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating custom record:', error);
      throw error;
    }
  }

  async getCustomRecords(tableName, limit = 100, offset = 0) {
    try {
      const records = await this.allQuery(
        `SELECT * FROM custom_data 
         WHERE table_name = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [tableName, limit, offset]
      );
      
      return records.map(record => ({
        id: record.id,
        tableName: record.table_name,
        data: JSON.parse(record.record_data),
        createdAt: record.created_at,
        updatedAt: record.updated_at
      }));
    } catch (error) {
      console.error('Error getting custom records:', error);
      throw error;
    }
  }

  async updateCustomRecord(id, recordData) {
    try {
      const dataStr = JSON.stringify(recordData);
      const result = await this.runQuery(
        `UPDATE custom_data 
         SET record_data = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [dataStr, id]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating custom record:', error);
      throw error;
    }
  }

  async deleteCustomRecord(id) {
    try {
      const result = await this.runQuery(`DELETE FROM custom_data WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting custom record:', error);
      throw error;
    }
  }

  // Configuration operations
  async setConfig(key, value, description = '') {
    try {
      await this.runQuery(
        `INSERT OR REPLACE INTO app_config (config_key, config_value, description, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [key, JSON.stringify(value), description]
      );
      return true;
    } catch (error) {
      console.error('Error setting config:', error);
      return false;
    }
  }

  async getConfig(key) {
    try {
      const result = await this.getQuery(
        `SELECT config_value FROM app_config WHERE config_key = ?`,
        [key]
      );
      return result ? JSON.parse(result.config_value) : null;
    } catch (error) {
      console.error('Error getting config:', error);
      return null;
    }
  }

  async getAllConfigs() {
    try {
      const configs = await this.allQuery(
        `SELECT * FROM app_config ORDER BY config_key`
      );
      return configs.map(config => ({
        key: config.config_key,
        value: JSON.parse(config.config_value),
        description: config.description,
        updatedAt: config.updated_at
      }));
    } catch (error) {
      console.error('Error getting all configs:', error);
      return [];
    }
  }

  // Logging operations
  async logApiCall(endpoint, method, statusCode, responseTimeMs, errorMessage = null) {
    try {
      await this.runQuery(
        `INSERT INTO api_logs (endpoint, method, status_code, response_time_ms, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        [endpoint, method, statusCode, responseTimeMs, errorMessage]
      );
    } catch (error) {
      console.error('Error logging API call:', error);
    }
  }

  async getApiLogs(limit = 100, offset = 0) {
    try {
      return await this.allQuery(
        `SELECT * FROM api_logs 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
    } catch (error) {
      console.error('Error getting API logs:', error);
      return [];
    }
  }

  // Session operations
  async createSession(sessionId, userData, ttlHours = 24) {
    try {
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
      const dataStr = JSON.stringify(userData || {});
      
      await this.runQuery(
        `INSERT INTO user_sessions (session_id, user_data, expires_at)
         VALUES (?, ?, ?)`,
        [sessionId, dataStr, expiresAt]
      );
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      return false;
    }
  }

  async getSession(sessionId) {
    try {
      const result = await this.getQuery(
        `SELECT * FROM user_sessions 
         WHERE session_id = ? AND expires_at > datetime('now')`,
        [sessionId]
      );
      
      if (result) {
        return {
          id: result.id,
          sessionId: result.session_id,
          userData: JSON.parse(result.user_data),
          expiresAt: result.expires_at,
          createdAt: result.created_at
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async deleteSession(sessionId) {
    try {
      const result = await this.runQuery(
        `DELETE FROM user_sessions WHERE session_id = ?`,
        [sessionId]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  // Statistics and monitoring
  async getDatabaseStats() {
    try {
      const stats = {};
      
      // Count records in each table
      const tables = ['api_cache', 'custom_data', 'api_logs', 'app_config', 'user_sessions', 'sync_logs', 'climate_projects', 'marketing_projects', 'marketing_metrics', 'marketing_data'];
      
      for (const table of tables) {
        const result = await this.getQuery(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = result ? result.count : 0;
      }
      
      // Get cache hit rate (simplified)
      const cacheStats = await this.getQuery(`
        SELECT 
          COUNT(*) as total_cache_ops,
          SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) as active_cache_entries
        FROM api_cache
      `);
      
      stats.cache_hit_rate = cacheStats ? 
        ((cacheStats.active_cache_entries / cacheStats.total_cache_ops) * 100).toFixed(2) : 0;
      
      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {};
    }
  }

  // Cleanup operations
  async cleanup() {
    try {
      await this.clearExpiredCache();
      
      // Clean old logs (keep last 30 days)
      const result = await this.runQuery(
        `DELETE FROM api_logs WHERE created_at < datetime('now', '-30 days')`
      );
      console.log(`Cleaned ${result.changes} old log entries`);
      
      // Clean expired sessions
      const sessionResult = await this.runQuery(
        `DELETE FROM user_sessions WHERE expires_at <= datetime('now')`
      );
      console.log(`Cleaned ${sessionResult.changes} expired sessions`);
      
      return true;
    } catch (error) {
      console.error('Error during cleanup:', error);
      return false;
    }
  }

  // Climate Projects operations
  async createClimateProject(projectData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO climate_projects (
          project, amount, unit, duration, status, location, partner,
          direct_beneficiary, indirect_beneficiary, environmental_outcome, brief,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          projectData.project,
          projectData.amount,
          projectData.unit,
          projectData.duration,
          projectData.status,
          projectData.location,
          projectData.partner,
          projectData.directBeneficiary || 0,
          projectData.indirectBeneficiary || 0,
          projectData.environmentalOutcome || '',
          projectData.brief || ''
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating climate project:', error);
      throw error;
    }
  }

  async getAllClimateProjects(limit = 1000, offset = 0) {
    try {
      const projects = await this.allQuery(
        `SELECT * FROM climate_projects
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      return projects.map(p => ({
        id: p.id,
        project: p.project,
        amount: p.amount,
        unit: p.unit,
        duration: p.duration,
        status: p.status,
        location: p.location,
        partner: p.partner,
        directBeneficiary: p.direct_beneficiary,
        indirectBeneficiary: p.indirect_beneficiary,
        environmentalOutcome: p.environmental_outcome,
        brief: p.brief,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
    } catch (error) {
      console.error('Error getting climate projects:', error);
      throw error;
    }
  }

  async getClimateProjectById(id) {
    try {
      const p = await this.getQuery(
        `SELECT * FROM climate_projects WHERE id = ?`,
        [id]
      );

      if (!p) return null;

      return {
        id: p.id,
        project: p.project,
        amount: p.amount,
        unit: p.unit,
        duration: p.duration,
        status: p.status,
        location: p.location,
        partner: p.partner,
        directBeneficiary: p.direct_beneficiary,
        indirectBeneficiary: p.indirect_beneficiary,
        environmentalOutcome: p.environmental_outcome,
        brief: p.brief,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      };
    } catch (error) {
      console.error('Error getting climate project:', error);
      throw error;
    }
  }

  async updateClimateProject(id, projectData) {
    try {
      const result = await this.runQuery(
        `UPDATE climate_projects SET
          project = ?,
          amount = ?,
          unit = ?,
          duration = ?,
          status = ?,
          location = ?,
          partner = ?,
          direct_beneficiary = ?,
          indirect_beneficiary = ?,
          environmental_outcome = ?,
          brief = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          projectData.project,
          projectData.amount,
          projectData.unit,
          projectData.duration,
          projectData.status,
          projectData.location,
          projectData.partner,
          projectData.directBeneficiary || 0,
          projectData.indirectBeneficiary || 0,
          projectData.environmentalOutcome || '',
          projectData.brief || '',
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating climate project:', error);
      throw error;
    }
  }

  async deleteClimateProject(id) {
    try {
      const result = await this.runQuery(
        `DELETE FROM climate_projects WHERE id = ?`,
        [id]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting climate project:', error);
      throw error;
    }
  }

  async getClimateProjectStats() {
    try {
      const stats = await this.getQuery(`
        SELECT
          COUNT(*) as total_projects,
          SUM(direct_beneficiary) as total_direct_beneficiaries,
          SUM(indirect_beneficiary) as total_indirect_beneficiaries,
          SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done_count,
          SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count
        FROM climate_projects
      `);

      return {
        totalProjects: stats.total_projects || 0,
        directBeneficiaries: stats.total_direct_beneficiaries || 0,
        indirectBeneficiaries: stats.total_indirect_beneficiaries || 0,
        projectsByStatus: {
          done: stats.done_count || 0,
          inProgress: stats.in_progress_count || 0
        }
      };
    } catch (error) {
      console.error('Error getting climate project stats:', error);
      throw error;
    }
  }

  // ==========================================
  // Marketing Data Operations
  // ==========================================

  // Project operations
  async createMarketingProject(projectData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO marketing_projects (project_key, project_name, description, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [projectData.projectKey, projectData.projectName, projectData.description || '']
      );
      return result.id;
    } catch (error) {
      console.error('Error creating marketing project:', error);
      throw error;
    }
  }

  async getAllMarketingProjects() {
    try {
      const projects = await this.allQuery(
        `SELECT * FROM marketing_projects ORDER BY project_name ASC`
      );
      return projects.map(p => ({
        id: p.id,
        projectKey: p.project_key,
        projectName: p.project_name,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
    } catch (error) {
      console.error('Error getting marketing projects:', error);
      throw error;
    }
  }

  async getMarketingProjectByKey(projectKey) {
    try {
      const p = await this.getQuery(
        `SELECT * FROM marketing_projects WHERE project_key = ?`,
        [projectKey]
      );
      if (!p) return null;
      return {
        id: p.id,
        projectKey: p.project_key,
        projectName: p.project_name,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      };
    } catch (error) {
      console.error('Error getting marketing project:', error);
      throw error;
    }
  }

  // Metric operations
  async createMarketingMetric(metricData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO marketing_metrics (project_id, metric_key, metric_label, category)
         VALUES (?, ?, ?, ?)`,
        [metricData.projectId, metricData.metricKey, metricData.metricLabel, metricData.category || '']
      );
      return result.id;
    } catch (error) {
      console.error('Error creating marketing metric:', error);
      throw error;
    }
  }

  async getMarketingMetricsByProject(projectId) {
    try {
      const metrics = await this.allQuery(
        `SELECT * FROM marketing_metrics WHERE project_id = ? ORDER BY category, metric_label`,
        [projectId]
      );
      return metrics.map(m => ({
        id: m.id,
        projectId: m.project_id,
        metricKey: m.metric_key,
        metricLabel: m.metric_label,
        category: m.category,
        createdAt: m.created_at
      }));
    } catch (error) {
      console.error('Error getting marketing metrics:', error);
      throw error;
    }
  }

  async getMarketingMetricByKey(projectId, metricKey) {
    try {
      const m = await this.getQuery(
        `SELECT * FROM marketing_metrics WHERE project_id = ? AND metric_key = ?`,
        [projectId, metricKey]
      );
      if (!m) return null;
      return {
        id: m.id,
        projectId: m.project_id,
        metricKey: m.metric_key,
        metricLabel: m.metric_label,
        category: m.category,
        createdAt: m.created_at
      };
    } catch (error) {
      console.error('Error getting marketing metric:', error);
      throw error;
    }
  }

  // Data operations
  async upsertMarketingData(dataPoint) {
    try {
      await this.runQuery(
        `INSERT INTO marketing_data (project_id, metric_id, date, value, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(project_id, metric_id, date)
         DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [dataPoint.projectId, dataPoint.metricId, dataPoint.date, dataPoint.value]
      );
      return true;
    } catch (error) {
      console.error('Error upserting marketing data:', error);
      throw error;
    }
  }

  async bulkUpsertMarketingData(dataPoints) {
    try {
      for (const dataPoint of dataPoints) {
        await this.upsertMarketingData(dataPoint);
      }
      return dataPoints.length;
    } catch (error) {
      console.error('Error bulk upserting marketing data:', error);
      throw error;
    }
  }

  async getMarketingData(projectId, fromDate, toDate, metricIds = null) {
    try {
      let query = `
        SELECT md.*, mm.metric_key, mm.metric_label, mm.category
        FROM marketing_data md
        JOIN marketing_metrics mm ON md.metric_id = mm.id
        WHERE md.project_id = ?
        AND md.date >= ? AND md.date <= ?
      `;
      const params = [projectId, fromDate, toDate];

      if (metricIds && metricIds.length > 0) {
        query += ` AND md.metric_id IN (${metricIds.map(() => '?').join(',')})`;
        params.push(...metricIds);
      }

      query += ` ORDER BY md.date ASC, mm.metric_label ASC`;

      const data = await this.allQuery(query, params);
      return data.map(d => ({
        id: d.id,
        projectId: d.project_id,
        metricId: d.metric_id,
        metricKey: d.metric_key,
        metricLabel: d.metric_label,
        category: d.category,
        date: d.date,
        value: d.value,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
    } catch (error) {
      console.error('Error getting marketing data:', error);
      throw error;
    }
  }

  async getMarketingDataGroupedByMetric(projectId, fromDate, toDate) {
    try {
      const data = await this.getMarketingData(projectId, fromDate, toDate);
      const grouped = {};

      data.forEach(d => {
        if (!grouped[d.metricKey]) {
          grouped[d.metricKey] = {
            metricId: d.metricId,
            metricKey: d.metricKey,
            metricLabel: d.metricLabel,
            category: d.category,
            data: []
          };
        }
        grouped[d.metricKey].data.push({
          date: d.date,
          value: d.value
        });
      });

      return grouped;
    } catch (error) {
      console.error('Error getting grouped marketing data:', error);
      throw error;
    }
  }

  async getMarketingStats(projectId, fromDate, toDate) {
    try {
      const stats = await this.allQuery(`
        SELECT
          mm.metric_key,
          mm.metric_label,
          mm.category,
          COUNT(md.value) as data_points,
          SUM(md.value) as total,
          AVG(md.value) as average,
          MAX(md.value) as max,
          MIN(md.value) as min
        FROM marketing_metrics mm
        LEFT JOIN marketing_data md ON mm.id = md.metric_id
          AND md.project_id = ?
          AND md.date >= ? AND md.date <= ?
        WHERE mm.project_id = ?
        GROUP BY mm.id, mm.metric_key, mm.metric_label, mm.category
        ORDER BY mm.category, mm.metric_label
      `, [projectId, fromDate, toDate, projectId]);

      return stats.map(s => ({
        metricKey: s.metric_key,
        metricLabel: s.metric_label,
        category: s.category,
        dataPoints: s.data_points || 0,
        total: Math.round(s.total || 0),
        average: Math.round((s.average || 0) * 100) / 100,
        max: s.max || 0,
        min: s.min || 0
      }));
    } catch (error) {
      console.error('Error getting marketing stats:', error);
      throw error;
    }
  }

  async deleteMarketingData(projectId, metricId, date) {
    try {
      const result = await this.runQuery(
        `DELETE FROM marketing_data WHERE project_id = ? AND metric_id = ? AND date = ?`,
        [projectId, metricId, date]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting marketing data:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve(!err);
        });
      });
    }
  }
}

module.exports = DatabaseService;