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
      )`,

      // MLI Operations programs
      `CREATE TABLE IF NOT EXISTS mli_ops_programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program TEXT NOT NULL UNIQUE,
        number_of_participants INTEGER,
        male_participants INTEGER,
        female_participants INTEGER,
        cash_revenue REAL,
        non_monetary_revenue REAL,
        total_revenue REAL,
        program_cost REAL,
        avg_content_rating REAL,
        avg_delivery_rating REAL,
        avg_overall_rating REAL,
        participant_fee REAL,
        status TEXT DEFAULT 'planned',
        start_date TEXT,
        end_date TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    try {
      for (const table of tables) {
        await this.runQuery(table);
      }
      await this.ensureMliOpsSchema();
      await this.ensurePropertyRentalSchema();
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

  // ==========================================
  // MLI OPERATIONS PROGRAMS
  // ==========================================

  async ensureMliOpsSchema() {
    // Create new tables for modules, trainers, and surveys
    const newTables = [
      // Program Modules
      `CREATE TABLE IF NOT EXISTS mli_ops_program_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        duration_days REAL,
        unit_price REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (program_id) REFERENCES mli_ops_programs(id) ON DELETE CASCADE,
        UNIQUE (program_id, name)
      )`,

      // Trainers
      `CREATE TABLE IF NOT EXISTS mli_ops_trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        trainer_type TEXT NOT NULL CHECK (trainer_type IN ('local', 'expat')),
        email TEXT,
        phone TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Module-Trainer Assignments
      `CREATE TABLE IF NOT EXISTS mli_ops_module_trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL,
        trainer_id INTEGER NOT NULL,
        role TEXT,
        trainer_fee REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES mli_ops_program_modules(id) ON DELETE CASCADE,
        FOREIGN KEY (trainer_id) REFERENCES mli_ops_trainers(id) ON DELETE RESTRICT,
        UNIQUE (module_id, trainer_id)
      )`,

      // Program Surveys
      `CREATE TABLE IF NOT EXISTS mli_ops_program_surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL,
        respondent_type TEXT,
        content_rating INTEGER CHECK (content_rating BETWEEN 1 AND 5),
        delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
        overall_rating REAL,
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (program_id) REFERENCES mli_ops_programs(id) ON DELETE CASCADE
      )`
    ];

    for (const tableQuery of newTables) {
      try {
        await this.runQuery(tableQuery);
      } catch (error) {
        console.error('Error creating MLI Ops table:', error);
      }
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_modules_program_id ON mli_ops_program_modules(program_id)',
      'CREATE INDEX IF NOT EXISTS idx_module_trainers_module_id ON mli_ops_module_trainers(module_id)',
      'CREATE INDEX IF NOT EXISTS idx_module_trainers_trainer_id ON mli_ops_module_trainers(trainer_id)',
      'CREATE INDEX IF NOT EXISTS idx_surveys_program_id ON mli_ops_program_surveys(program_id)',
      'CREATE INDEX IF NOT EXISTS idx_trainers_type ON mli_ops_trainers(trainer_type)',
      'CREATE INDEX IF NOT EXISTS idx_trainers_active ON mli_ops_trainers(active)'
    ];

    for (const indexQuery of indexes) {
      try {
        await this.runQuery(indexQuery);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn('Index creation warning:', error.message);
        }
      }
    }
  }

  async getAllMliOpsPrograms() {
    try {
      return await this.allQuery(
        `SELECT * FROM mli_ops_programs ORDER BY
          CASE WHEN start_date IS NULL THEN 1 ELSE 0 END,
          start_date, program`
      );
    } catch (error) {
      console.error('Error fetching MLI operations programs:', error);
      throw error;
    }
  }

  async getMliOpsProgramById(id) {
    try {
      return await this.getQuery(`SELECT * FROM mli_ops_programs WHERE id = ?`, [id]);
    } catch (error) {
      console.error('Error fetching MLI operations program:', error);
      throw error;
    }
  }

  async getMliOpsProgramCount() {
    try {
      const row = await this.getQuery(`SELECT COUNT(*) as count FROM mli_ops_programs`);
      return row?.count || 0;
    } catch (error) {
      console.error('Error counting MLI operations programs:', error);
      throw error;
    }
  }

  async upsertMliOpsProgram(program) {
    if (!program || !program.program) {
      throw new Error('Program name is required');
    }

    const toNumber = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const num = Number(value);
      return Number.isNaN(num) ? null : num;
    };

    const toInteger = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const num = parseInt(value, 10);
      return Number.isNaN(num) ? null : num;
    };

    const trimDate = (value) => {
      if (!value) return null;
      return String(value).split('T')[0];
    };

    const participants = toInteger(program.number_of_participants);
    const maleParticipants = toInteger(program.male_participants || program.male);
    const femaleParticipants = toInteger(program.female_participants || program.female);
    const participantFee = toNumber(program.participant_fee);
    const nonMonetaryRevenue = toNumber(program.non_monetary_revenue);

    // Calculate cash_revenue
    const cashRevenue = program.cash_revenue !== undefined && program.cash_revenue !== null
      ? toNumber(program.cash_revenue)
      : (toNumber(program.total_revenue_input) ??
         (participants && participantFee ? participants * participantFee : null));

    // Calculate total_revenue
    const totalRevenue = program.total_revenue !== undefined && program.total_revenue !== null
      ? toNumber(program.total_revenue)
      : (toNumber(program.actual_revenue) ??
         (((cashRevenue ?? 0) + (nonMonetaryRevenue ?? 0)) || null));

    let status = program.status;
    if (!status || status === 'auto') {
      const today = new Date().toISOString().split('T')[0];
      const startDate = trimDate(program.start_date);
      if (startDate && startDate > today) {
        status = 'planned';
      } else if ((participants || 0) > 0 || (totalRevenue || 0) > 0) {
        status = 'completed';
      } else {
        status = 'planned';
      }
    }

    const programCost = toNumber(program.program_cost ?? program.cost_per_program ?? program.total_cost);

    const payload = [
      program.program.trim(),
      participants,
      maleParticipants,
      femaleParticipants,
      cashRevenue,
      nonMonetaryRevenue,
      totalRevenue,
      programCost,
      toNumber(program.avg_content_rating),
      toNumber(program.avg_delivery_rating),
      toNumber(program.avg_overall_rating),
      participantFee,
      status,
      trimDate(program.start_date),
      trimDate(program.end_date),
      program.notes || null
    ];

    try {
      if (program.id) {
        await this.runQuery(`
          UPDATE mli_ops_programs SET
            program = ?,
            number_of_participants = ?,
            male_participants = ?,
            female_participants = ?,
            cash_revenue = ?,
            non_monetary_revenue = ?,
            total_revenue = ?,
            program_cost = ?,
            avg_content_rating = ?,
            avg_delivery_rating = ?,
            avg_overall_rating = ?,
            participant_fee = ?,
            status = ?,
            start_date = ?,
            end_date = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [...payload, program.id]);
        return program.id;
      }

      const result = await this.runQuery(`
        INSERT INTO mli_ops_programs (
          program, number_of_participants, male_participants, female_participants,
          cash_revenue, non_monetary_revenue, total_revenue, program_cost,
          avg_content_rating, avg_delivery_rating, avg_overall_rating,
          participant_fee, status, start_date, end_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, payload);
      return result.id;
    } catch (error) {
      console.error('Error saving MLI operations program:', error);
      throw error;
    }
  }

  async deleteMliOpsProgram(id) {
    try {
      const result = await this.runQuery(`DELETE FROM mli_ops_programs WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting MLI operations program:', error);
      throw error;
    }
  }

  async clearMliOpsPrograms() {
    try {
      await this.runQuery(`DELETE FROM mli_ops_programs`);
      return true;
    } catch (error) {
      console.error('Error clearing MLI operations programs:', error);
      throw error;
    }
  }

  async bulkUpsertMliOpsPrograms(programs = []) {
    if (!programs.length) {
      return 0;
    }

    try {
      await this.runQuery('BEGIN TRANSACTION');
      for (const program of programs) {
        await this.upsertMliOpsProgram(program);
      }
      await this.runQuery('COMMIT');
      return programs.length;
    } catch (error) {
      await this.runQuery('ROLLBACK');
      console.error('Error bulk upserting MLI operations programs:', error);
      throw error;
    }
  }

  // ==========================================
  // MLI OPERATIONS - TRAINERS
  // ==========================================

  async getAllTrainers(includeInactive = false) {
    try {
      const query = includeInactive
        ? 'SELECT * FROM mli_ops_trainers ORDER BY full_name'
        : 'SELECT * FROM mli_ops_trainers WHERE active = 1 ORDER BY full_name';
      return await this.allQuery(query);
    } catch (error) {
      console.error('Error fetching trainers:', error);
      throw error;
    }
  }

  async getTrainerById(id) {
    try {
      return await this.getQuery('SELECT * FROM mli_ops_trainers WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching trainer:', error);
      throw error;
    }
  }

  async createTrainer(trainerData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO mli_ops_trainers (full_name, trainer_type, email, phone, active)
         VALUES (?, ?, ?, ?, ?)`,
        [
          trainerData.full_name || trainerData.fullName,
          trainerData.trainer_type || trainerData.trainerType,
          trainerData.email || null,
          trainerData.phone || null,
          trainerData.active !== undefined ? trainerData.active : 1
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating trainer:', error);
      throw error;
    }
  }

  async updateTrainer(id, trainerData) {
    try {
      const result = await this.runQuery(
        `UPDATE mli_ops_trainers SET
          full_name = ?,
          trainer_type = ?,
          email = ?,
          phone = ?,
          active = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          trainerData.full_name || trainerData.fullName,
          trainerData.trainer_type || trainerData.trainerType,
          trainerData.email || null,
          trainerData.phone || null,
          trainerData.active !== undefined ? trainerData.active : 1,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating trainer:', error);
      throw error;
    }
  }

  async deleteTrainer(id) {
    try {
      const result = await this.runQuery('DELETE FROM mli_ops_trainers WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting trainer:', error);
      throw error;
    }
  }

  async deactivateTrainer(id) {
    try {
      const result = await this.runQuery(
        'UPDATE mli_ops_trainers SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error deactivating trainer:', error);
      throw error;
    }
  }

  // ==========================================
  // MLI OPERATIONS - MODULES
  // ==========================================

  async getModulesByProgramId(programId) {
    try {
      return await this.allQuery(
        'SELECT * FROM mli_ops_program_modules WHERE program_id = ? ORDER BY name',
        [programId]
      );
    } catch (error) {
      console.error('Error fetching modules:', error);
      throw error;
    }
  }

  async getModuleById(id) {
    try {
      return await this.getQuery('SELECT * FROM mli_ops_program_modules WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching module:', error);
      throw error;
    }
  }

  async createModule(moduleData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO mli_ops_program_modules (program_id, name, description, duration_days, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [
          moduleData.program_id || moduleData.programId,
          moduleData.name,
          moduleData.description || null,
          moduleData.duration_days || moduleData.durationDays || null,
          moduleData.unit_price || moduleData.unitPrice || null
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating module:', error);
      throw error;
    }
  }

  async updateModule(id, moduleData) {
    try {
      const result = await this.runQuery(
        `UPDATE mli_ops_program_modules SET
          name = ?,
          description = ?,
          duration_days = ?,
          unit_price = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          moduleData.name,
          moduleData.description || null,
          moduleData.duration_days || moduleData.durationDays || null,
          moduleData.unit_price || moduleData.unitPrice || null,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating module:', error);
      throw error;
    }
  }

  async deleteModule(id) {
    try {
      const result = await this.runQuery('DELETE FROM mli_ops_program_modules WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting module:', error);
      throw error;
    }
  }

  // ==========================================
  // MLI OPERATIONS - MODULE TRAINERS
  // ==========================================

  async getModuleTrainers(moduleId) {
    try {
      return await this.allQuery(
        `SELECT mt.*, t.full_name, t.trainer_type, t.email, t.phone
         FROM mli_ops_module_trainers mt
         JOIN mli_ops_trainers t ON mt.trainer_id = t.id
         WHERE mt.module_id = ?`,
        [moduleId]
      );
    } catch (error) {
      console.error('Error fetching module trainers:', error);
      throw error;
    }
  }

  async getTrainerModules(trainerId) {
    try {
      return await this.allQuery(
        `SELECT mt.*, m.name as module_name, m.program_id, p.program as program_name
         FROM mli_ops_module_trainers mt
         JOIN mli_ops_program_modules m ON mt.module_id = m.id
         JOIN mli_ops_programs p ON m.program_id = p.id
         WHERE mt.trainer_id = ?`,
        [trainerId]
      );
    } catch (error) {
      console.error('Error fetching trainer modules:', error);
      throw error;
    }
  }

  async assignTrainerToModule(assignmentData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO mli_ops_module_trainers (module_id, trainer_id, role, trainer_fee)
         VALUES (?, ?, ?, ?)`,
        [
          assignmentData.module_id || assignmentData.moduleId,
          assignmentData.trainer_id || assignmentData.trainerId,
          assignmentData.role || null,
          assignmentData.trainer_fee || assignmentData.trainerFee || null
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error assigning trainer to module:', error);
      throw error;
    }
  }

  async updateModuleTrainerAssignment(id, assignmentData) {
    try {
      const result = await this.runQuery(
        `UPDATE mli_ops_module_trainers SET
          role = ?,
          trainer_fee = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          assignmentData.role || null,
          assignmentData.trainer_fee || assignmentData.trainerFee || null,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating module trainer assignment:', error);
      throw error;
    }
  }

  async removeTrainerFromModule(id) {
    try {
      const result = await this.runQuery('DELETE FROM mli_ops_module_trainers WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error removing trainer from module:', error);
      throw error;
    }
  }

  // ==========================================
  // MLI OPERATIONS - PROGRAM SURVEYS
  // ==========================================

  async getSurveysByProgramId(programId) {
    try {
      return await this.allQuery(
        'SELECT * FROM mli_ops_program_surveys WHERE program_id = ? ORDER BY created_at DESC',
        [programId]
      );
    } catch (error) {
      console.error('Error fetching program surveys:', error);
      throw error;
    }
  }

  async getSurveyById(id) {
    try {
      return await this.getQuery('SELECT * FROM mli_ops_program_surveys WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching survey:', error);
      throw error;
    }
  }

  async createSurvey(surveyData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO mli_ops_program_surveys
         (program_id, respondent_type, content_rating, delivery_rating, overall_rating, comments)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          surveyData.program_id || surveyData.programId,
          surveyData.respondent_type || surveyData.respondentType || null,
          surveyData.content_rating || surveyData.contentRating || null,
          surveyData.delivery_rating || surveyData.deliveryRating || null,
          surveyData.overall_rating || surveyData.overallRating || null,
          surveyData.comments || null
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating survey:', error);
      throw error;
    }
  }

  async updateSurvey(id, surveyData) {
    try {
      const result = await this.runQuery(
        `UPDATE mli_ops_program_surveys SET
          respondent_type = ?,
          content_rating = ?,
          delivery_rating = ?,
          overall_rating = ?,
          comments = ?
         WHERE id = ?`,
        [
          surveyData.respondent_type || surveyData.respondentType || null,
          surveyData.content_rating || surveyData.contentRating || null,
          surveyData.delivery_rating || surveyData.deliveryRating || null,
          surveyData.overall_rating || surveyData.overallRating || null,
          surveyData.comments || null,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating survey:', error);
      throw error;
    }
  }

  async deleteSurvey(id) {
    try {
      const result = await this.runQuery('DELETE FROM mli_ops_program_surveys WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting survey:', error);
      throw error;
    }
  }

  async getProgramSurveyAggregates(programId) {
    try {
      const stats = await this.getQuery(
        `SELECT
          COUNT(*) as total_responses,
          AVG(content_rating) as avg_content_rating,
          AVG(delivery_rating) as avg_delivery_rating,
          AVG(overall_rating) as avg_overall_rating
         FROM mli_ops_program_surveys
         WHERE program_id = ?`,
        [programId]
      );
      return {
        totalResponses: stats?.total_responses || 0,
        avgContentRating: stats?.avg_content_rating || null,
        avgDeliveryRating: stats?.avg_delivery_rating || null,
        avgOverallRating: stats?.avg_overall_rating || null
      };
    } catch (error) {
      console.error('Error getting survey aggregates:', error);
      throw error;
    }
  }

  async updateProgramSurveyAggregates(programId) {
    try {
      const aggregates = await this.getProgramSurveyAggregates(programId);
      await this.runQuery(
        `UPDATE mli_ops_programs SET
          avg_content_rating = ?,
          avg_delivery_rating = ?,
          avg_overall_rating = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          aggregates.avgContentRating,
          aggregates.avgDeliveryRating,
          aggregates.avgOverallRating,
          programId
        ]
      );
      return aggregates;
    } catch (error) {
      console.error('Error updating program survey aggregates:', error);
      throw error;
    }
  }

  // ==========================================
  // PROPERTY RENTAL MANAGEMENT
  // ==========================================

  async ensurePropertyRentalSchema() {
    const tables = [
      // Buildings
      `CREATE TABLE IF NOT EXISTS buildings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        address TEXT,
        notes TEXT
      )`,

      // Floors
      `CREATE TABLE IF NOT EXISTS floors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        level_no INTEGER,
        sort_order INTEGER NOT NULL,
        UNIQUE (building_id, label)
      )`,

      // Units
      `CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
        floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        usage_type TEXT NOT NULL,
        rental_area_sqm REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'vacant',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        UNIQUE (building_id, code)
      )`,

      // Tenants
      `CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        building_id INTEGER REFERENCES buildings(id),
        category TEXT,
        contact_name TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        notes TEXT
      )`,

      // Leases
      `CREATE TABLE IF NOT EXISTS leases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        rent_currency TEXT,
        rent_amount REAL,
        service_charge_amount REAL,
        raw_period_text TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    ];

    for (const tableQuery of tables) {
      try {
        await this.runQuery(tableQuery);
      } catch (error) {
        console.error('Error creating property rental table:', error);
      }
    }

    // Create trigger for leases update timestamp
    try {
      await this.runQuery(`
        CREATE TRIGGER IF NOT EXISTS leases_update_timestamp
        AFTER UPDATE ON leases
        BEGIN
          UPDATE leases SET updated_at = datetime('now') WHERE id = NEW.id;
        END
      `);
    } catch (error) {
      console.error('Error creating leases trigger:', error);
    }

    // Add service_charge_amount column if it doesn't exist (migration)
    try {
      await this.runQuery(`
        SELECT service_charge_amount FROM leases LIMIT 1
      `);
    } catch (error) {
      // Column doesn't exist, add it
      try {
        await this.runQuery(`
          ALTER TABLE leases ADD COLUMN service_charge_amount REAL
        `);
        console.log('Added service_charge_amount column to leases table');
      } catch (alterError) {
        console.error('Error adding service_charge_amount column:', alterError);
      }
    }

    // Add building_id to tenants if missing (migration)
    try {
      await this.runQuery(`
        SELECT building_id FROM tenants LIMIT 1
      `);
    } catch (error) {
      try {
        await this.runQuery(`
          ALTER TABLE tenants ADD COLUMN building_id INTEGER REFERENCES buildings(id)
        `);
        console.log('Added building_id column to tenants table');
      } catch (alterError) {
        console.error('Error adding building_id column:', alterError);
      }
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_floors_building_id ON floors(building_id)',
      'CREATE INDEX IF NOT EXISTS idx_units_building_id ON units(building_id)',
      'CREATE INDEX IF NOT EXISTS idx_units_floor_id ON units(floor_id)',
      'CREATE INDEX IF NOT EXISTS idx_units_status ON units(status)',
      'CREATE INDEX IF NOT EXISTS idx_tenants_building_id ON tenants(building_id)',
      'CREATE INDEX IF NOT EXISTS idx_leases_unit_id ON leases(unit_id)',
      'CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON leases(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status)'
    ];

    for (const indexQuery of indexes) {
      try {
        await this.runQuery(indexQuery);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn('Index creation warning:', error.message);
        }
      }
    }
  }

  // ==========================================
  // BUILDINGS
  // ==========================================

  async getAllBuildings() {
    try {
      return await this.allQuery('SELECT * FROM buildings ORDER BY name');
    } catch (error) {
      console.error('Error fetching buildings:', error);
      throw error;
    }
  }

  async getBuildingById(id) {
    try {
      return await this.getQuery('SELECT * FROM buildings WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching building:', error);
      throw error;
    }
  }

  async createBuilding(buildingData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO buildings (name, code, address, notes)
         VALUES (?, ?, ?, ?)`,
        [
          buildingData.name,
          buildingData.code,
          buildingData.address || null,
          buildingData.notes || null
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating building:', error);
      throw error;
    }
  }

  async updateBuilding(id, buildingData) {
    try {
      const result = await this.runQuery(
        `UPDATE buildings SET
          name = ?,
          code = ?,
          address = ?,
          notes = ?
         WHERE id = ?`,
        [
          buildingData.name,
          buildingData.code,
          buildingData.address || null,
          buildingData.notes || null,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating building:', error);
      throw error;
    }
  }

  async deleteBuilding(id) {
    try {
      const result = await this.runQuery('DELETE FROM buildings WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting building:', error);
      throw error;
    }
  }

  // ==========================================
  // FLOORS
  // ==========================================

  async getFloorsByBuildingId(buildingId) {
    try {
      return await this.allQuery(
        'SELECT * FROM floors WHERE building_id = ? ORDER BY sort_order',
        [buildingId]
      );
    } catch (error) {
      console.error('Error fetching floors:', error);
      throw error;
    }
  }

  async getFloorById(id) {
    try {
      return await this.getQuery('SELECT * FROM floors WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching floor:', error);
      throw error;
    }
  }

  async createFloor(floorData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO floors (building_id, label, level_no, sort_order)
         VALUES (?, ?, ?, ?)`,
        [
          floorData.building_id || floorData.buildingId,
          floorData.label,
          floorData.level_no || floorData.levelNo || null,
          floorData.sort_order || floorData.sortOrder
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating floor:', error);
      throw error;
    }
  }

  async updateFloor(id, floorData) {
    try {
      const result = await this.runQuery(
        `UPDATE floors SET
          label = ?,
          level_no = ?,
          sort_order = ?
         WHERE id = ?`,
        [
          floorData.label,
          floorData.level_no || floorData.levelNo || null,
          floorData.sort_order || floorData.sortOrder,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating floor:', error);
      throw error;
    }
  }

  async deleteFloor(id) {
    try {
      const result = await this.runQuery('DELETE FROM floors WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting floor:', error);
      throw error;
    }
  }

  // ==========================================
  // UNITS
  // ==========================================

  async generateUnitCode(buildingId, floorId) {
    try {
      // Get building code
      const building = await this.getBuildingById(buildingId);
      if (!building) throw new Error('Building not found');

      // Get floor label
      const floor = await this.getFloorById(floorId);
      if (!floor) throw new Error('Floor not found');

      // Get next sequential number for this floor
      const result = await this.getQuery(
        `SELECT MAX(CAST(SUBSTR(code, -2) AS INTEGER)) as max_seq
         FROM units
         WHERE building_id = ? AND floor_id = ?`,
        [buildingId, floorId]
      );

      const nextSeq = (result?.max_seq || 0) + 1;
      const seqStr = String(nextSeq).padStart(2, '0');

      return `${building.code}-${floor.label}-${seqStr}`;
    } catch (error) {
      console.error('Error generating unit code:', error);
      throw error;
    }
  }

  validateUnitCode(code) {
    // Regex: ^[A-Z0-9]{2,4}-(GF|RF|PK|EX|B[0-9]+|[0-9]{2})-[0-9]{2}$
    const regex = /^[A-Z0-9]{2,4}-(GF|RF|PK|EX|B[0-9]+|[0-9]{2})-[0-9]{2}$/;
    return regex.test(code);
  }

  async getAllUnits(limit = 1000, offset = 0) {
    try {
      return await this.allQuery(
        'SELECT * FROM units ORDER BY building_id, floor_id, code LIMIT ? OFFSET ?',
        [limit, offset]
      );
    } catch (error) {
      console.error('Error fetching units:', error);
      throw error;
    }
  }

  async getUnitsByBuildingId(buildingId, status = null) {
    try {
      let query = 'SELECT * FROM units WHERE building_id = ?';
      const params = [buildingId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY floor_id, code';
      return await this.allQuery(query, params);
    } catch (error) {
      console.error('Error fetching units by building:', error);
      throw error;
    }
  }

  async getUnitsByFloorId(floorId) {
    try {
      return await this.allQuery(
        'SELECT * FROM units WHERE floor_id = ? ORDER BY code',
        [floorId]
      );
    } catch (error) {
      console.error('Error fetching units by floor:', error);
      throw error;
    }
  }

  async getUnitById(id) {
    try {
      return await this.getQuery('SELECT * FROM units WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching unit:', error);
      throw error;
    }
  }

  async createUnit(unitData) {
    try {
      // Auto-generate code if not provided
      let code = unitData.code;
      if (!code) {
        code = await this.generateUnitCode(
          unitData.building_id || unitData.buildingId,
          unitData.floor_id || unitData.floorId
        );
      }

      // Validate code format
      if (!this.validateUnitCode(code)) {
        throw new Error(`Invalid unit code format: ${code}`);
      }

      const result = await this.runQuery(
        `INSERT INTO units (building_id, floor_id, code, name, usage_type, rental_area_sqm, status, is_active, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          unitData.building_id || unitData.buildingId,
          unitData.floor_id || unitData.floorId,
          code,
          unitData.name,
          unitData.usage_type || unitData.usageType,
          unitData.rental_area_sqm || unitData.rentalAreaSqm,
          unitData.status || 'vacant',
          unitData.is_active !== undefined ? unitData.is_active : (unitData.isActive !== undefined ? unitData.isActive : 1),
          unitData.notes || null
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating unit:', error);
      throw error;
    }
  }

  async updateUnit(id, unitData) {
    try {
      const result = await this.runQuery(
        `UPDATE units SET
          name = ?,
          usage_type = ?,
          rental_area_sqm = ?,
          status = ?,
          is_active = ?,
          notes = ?
         WHERE id = ?`,
        [
          unitData.name,
          unitData.usage_type || unitData.usageType,
          unitData.rental_area_sqm || unitData.rentalAreaSqm,
          unitData.status,
          unitData.is_active !== undefined ? unitData.is_active : (unitData.isActive !== undefined ? unitData.isActive : 1),
          unitData.notes || null,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating unit:', error);
      throw error;
    }
  }

  async deleteUnit(id) {
    try {
      const result = await this.runQuery('DELETE FROM units WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting unit:', error);
      throw error;
    }
  }

  // ==========================================
  // TENANTS
  // ==========================================

  async getAllTenants(searchQuery = null, buildingId = null) {
    try {
      let query = 'SELECT * FROM tenants';
      const params = [];
      const whereClauses = [];

      if (buildingId !== null && buildingId !== undefined) {
        whereClauses.push('building_id = ?');
        params.push(buildingId);
      }

      if (searchQuery) {
        whereClauses.push('(name LIKE ? OR contact_name LIKE ? OR contact_email LIKE ?)');
        params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      query += ' ORDER BY name';

      return await this.allQuery(query, params);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      throw error;
    }
  }

  async getTenantById(id) {
    try {
      return await this.getQuery('SELECT * FROM tenants WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching tenant:', error);
      throw error;
    }
  }

  async createTenant(tenantData) {
    try {
      const result = await this.runQuery(
        `INSERT INTO tenants (name, building_id, category, contact_name, contact_phone, contact_email, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantData.name,
          tenantData.building_id ?? tenantData.buildingId ?? null,
          tenantData.category || null,
          tenantData.contact_name || tenantData.contactName || null,
          tenantData.contact_phone || tenantData.contactPhone || null,
          tenantData.contact_email || tenantData.contactEmail || null,
          tenantData.notes || null
        ]
      );
      return result.id;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async updateTenant(id, tenantData) {
    try {
      const result = await this.runQuery(
        `UPDATE tenants SET
          name = ?,
          building_id = ?,
          category = ?,
          contact_name = ?,
          contact_phone = ?,
          contact_email = ?,
          notes = ?
         WHERE id = ?`,
        [
          tenantData.name,
          tenantData.building_id ?? tenantData.buildingId ?? null,
          tenantData.category || null,
          tenantData.contact_name || tenantData.contactName || null,
          tenantData.contact_phone || tenantData.contactPhone || null,
          tenantData.contact_email || tenantData.contactEmail || null,
          tenantData.notes || null,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  async deleteTenant(id) {
    try {
      const result = await this.runQuery('DELETE FROM tenants WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // ==========================================
  // LEASES
  // ==========================================

  async getLeasesByUnitId(unitId) {
    try {
      return await this.allQuery(
        'SELECT * FROM leases WHERE unit_id = ? ORDER BY start_date DESC',
        [unitId]
      );
    } catch (error) {
      console.error('Error fetching leases by unit:', error);
      throw error;
    }
  }

  async getLeaseById(id) {
    try {
      return await this.getQuery('SELECT * FROM leases WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error fetching lease:', error);
      throw error;
    }
  }

  async createLease(leaseData) {
    try {
      // Start transaction
      await this.runQuery('BEGIN TRANSACTION');

      // Create lease
      const result = await this.runQuery(
        `INSERT INTO leases (unit_id, tenant_id, start_date, end_date, status, rent_currency, rent_amount, service_charge_amount, raw_period_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leaseData.unit_id || leaseData.unitId,
          leaseData.tenant_id || leaseData.tenantId,
          leaseData.start_date || leaseData.startDate || null,
          leaseData.end_date || leaseData.endDate || null,
          leaseData.status || 'active',
          leaseData.rent_currency || leaseData.rentCurrency || null,
          leaseData.rent_amount || leaseData.rentAmount || null,
          leaseData.service_charge_amount || leaseData.serviceChargeAmount || null,
          leaseData.raw_period_text || leaseData.rawPeriodText || null
        ]
      );

      // Update unit status to occupied if lease is active
      if (!leaseData.status || leaseData.status === 'active') {
        await this.runQuery(
          'UPDATE units SET status = ? WHERE id = ?',
          ['occupied', leaseData.unit_id || leaseData.unitId]
        );
      }

      await this.runQuery('COMMIT');
      return result.id;
    } catch (error) {
      await this.runQuery('ROLLBACK');
      console.error('Error creating lease:', error);
      throw error;
    }
  }

  async updateLease(id, leaseData) {
    try {
      const result = await this.runQuery(
        `UPDATE leases SET
          start_date = ?,
          end_date = ?,
          status = ?,
          rent_currency = ?,
          rent_amount = ?,
          service_charge_amount = ?,
          raw_period_text = ?
         WHERE id = ?`,
        [
          leaseData.start_date || leaseData.startDate || null,
          leaseData.end_date || leaseData.endDate || null,
          leaseData.status || 'active',
          leaseData.rent_currency || leaseData.rentCurrency || null,
          leaseData.rent_amount || leaseData.rentAmount || null,
          leaseData.service_charge_amount || leaseData.serviceChargeAmount || null,
          leaseData.raw_period_text || leaseData.rawPeriodText || null,
          id
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating lease:', error);
      throw error;
    }
  }

  async terminateLease(id) {
    try {
      await this.runQuery('BEGIN TRANSACTION');

      // Get lease info
      const lease = await this.getLeaseById(id);
      if (!lease) {
        await this.runQuery('ROLLBACK');
        return false;
      }

      // Update lease status
      await this.runQuery(
        'UPDATE leases SET status = ? WHERE id = ?',
        ['terminated', id]
      );

      // Update unit status to vacant
      await this.runQuery(
        'UPDATE units SET status = ? WHERE id = ?',
        ['vacant', lease.unit_id]
      );

      await this.runQuery('COMMIT');
      return true;
    } catch (error) {
      await this.runQuery('ROLLBACK');
      console.error('Error terminating lease:', error);
      throw error;
    }
  }

  async deleteLease(id) {
    try {
      const result = await this.runQuery('DELETE FROM leases WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting lease:', error);
      throw error;
    }
  }

  // ==========================================
  // PROPERTY REPORTS
  // ==========================================

  async getVacancyReport(buildingId = null) {
    try {
      let whereClause = '';
      const params = [];

      if (buildingId) {
        whereClause = 'WHERE building_id = ?';
        params.push(buildingId);
      }

      const stats = await this.getQuery(`
        SELECT
          COUNT(*) as total_units,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
          SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant_units,
          SUM(rental_area_sqm) as total_area,
          SUM(CASE WHEN status = 'occupied' THEN rental_area_sqm ELSE 0 END) as rented_area,
          SUM(CASE WHEN status = 'vacant' THEN rental_area_sqm ELSE 0 END) as vacant_area
        FROM units
        ${whereClause}
      `, params);

      const totalUnits = stats?.total_units || 0;
      const occupiedUnits = stats?.occupied_units || 0;
      const vacantUnits = stats?.vacant_units || 0;
      const totalArea = stats?.total_area || 0;
      const rentedArea = stats?.rented_area || 0;
      const vacantArea = stats?.vacant_area || 0;

      const occupancyPercent = totalUnits > 0
        ? Math.round((occupiedUnits / totalUnits) * 10000) / 100
        : 0;

      return {
        total_units: totalUnits,
        occupied_units: occupiedUnits,
        vacant_units: vacantUnits,
        total_area: totalArea,
        rented_area: rentedArea,
        vacant_area: vacantArea,
        occupancy_percent: occupancyPercent
      };
    } catch (error) {
      console.error('Error generating vacancy report:', error);
      throw error;
    }
  }

  async getExpiringLeases(buildingId = null, withinDays = 90) {
    try {
      let query = `
        SELECT l.*, u.code as unit_code, u.name as unit_name, t.name as tenant_name
        FROM leases l
        JOIN units u ON l.unit_id = u.id
        JOIN tenants t ON l.tenant_id = t.id
        WHERE l.status = 'active'
        AND l.end_date IS NOT NULL
        AND l.end_date <= date('now', '+' || ? || ' days')
      `;
      const params = [withinDays];

      if (buildingId) {
        query += ' AND u.building_id = ?';
        params.push(buildingId);
      }

      query += ' ORDER BY l.end_date ASC';

      return await this.allQuery(query, params);
    } catch (error) {
      console.error('Error fetching expiring leases:', error);
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
