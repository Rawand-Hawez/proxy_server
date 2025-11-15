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
      const tables = ['api_cache', 'custom_data', 'api_logs', 'app_config', 'user_sessions', 'sync_logs'];
      
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