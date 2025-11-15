/**
 * Example: How to Add New Tables to Database
 * 
 * This file shows how to extend the databaseService.js with new tables
 * and provides practical examples for different use cases.
 */

// ============================================
// STEP 1: ADD NEW TABLE TO createTables()
// ============================================

/**
 * In your databaseService.js file, add this to the createTables() method:
 */

const NEW_TABLES_EXAMPLE = [
  // ... existing tables ...
  
  // Example 1: Products table
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT,
    sku TEXT UNIQUE,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Example 2: Customers table
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    is_vip BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Example 3: Orders table
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    product_id INTEGER,
    quantity INTEGER DEFAULT 1,
    total_price REAL NOT NULL,
    order_status TEXT DEFAULT 'pending',
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`,
  
  // Example 4: Inventory tracking
  `CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL, -- 'in', 'out', 'adjustment'
    quantity INTEGER NOT NULL,
    reason TEXT,
    reference_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`
];

// ============================================
// STEP 2: ADD CRUD METHODS FOR NEW TABLES
// ============================================

class DatabaseServiceExtension {
  
  // Products operations
  async createProduct(productData) {
    try {
      const { name, description, price, category, sku, stock_quantity = 0, is_active = 1 } = productData;
      
      const result = await this.runQuery(
        `INSERT INTO products (name, description, price, category, sku, stock_quantity, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [name, description, price, category, sku, stock_quantity, is_active]
      );
      
      return result.id;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async getProducts(limit = 100, offset = 0, filters = {}) {
    try {
      let whereClause = [];
      let params = [];
      
      // Build dynamic WHERE clause
      if (filters.category) {
        whereClause.push('category = ?');
        params.push(filters.category);
      }
      
      if (filters.is_active !== undefined) {
        whereClause.push('is_active = ?');
        params.push(filters.is_active ? 1 : 0);
      }
      
      if (filters.min_price) {
        whereClause.push('price >= ?');
        params.push(filters.min_price);
      }
      
      if (filters.max_price) {
        whereClause.push('price <= ?');
        params.push(filters.max_price);
      }
      
      const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
      
      const products = await this.allQuery(
        `SELECT * FROM products ${whereSQL}
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      
      return products;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  async updateProduct(id, productData) {
    try {
      const updates = [];
      const params = [];
      
      Object.keys(productData).forEach(key => {
        if (productData[key] !== undefined) {
          updates.push(`${key} = ?`);
          params.push(productData[key]);
        }
      });
      
      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      
      const result = await this.runQuery(
        `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const result = await this.runQuery('DELETE FROM products WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Customer operations
  async createCustomer(customerData) {
    try {
      const { name, email, phone, address, city, country, is_vip = 0 } = customerData;
      
      const result = await this.runQuery(
        `INSERT INTO customers (name, email, phone, address, city, country, is_vip, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [name, email, phone, address, city, country, is_vip]
      );
      
      return result.id;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  async getCustomers(limit = 100, offset = 0, searchTerm = '') {
    try {
      let query = `
        SELECT * FROM customers 
        WHERE name LIKE ? OR email LIKE ?
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      const searchPattern = `%${searchTerm}%`;
      const customers = await this.allQuery(query, [searchPattern, searchPattern, limit, offset]);
      
      return customers;
    } catch (error) {
      console.error('Error getting customers:', error);
      throw error;
    }
  }

  // Order operations
  async createOrder(orderData) {
    try {
      const { customer_id, product_id, quantity, total_price, order_status = 'pending' } = orderData;
      
      const result = await this.runQuery(
        `INSERT INTO orders (customer_id, product_id, quantity, total_price, order_status)
         VALUES (?, ?, ?, ?, ?)`,
        [customer_id, product_id, quantity, total_price, order_status]
      );
      
      return result.id;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  async getOrders(limit = 100, offset = 0, status = null) {
    try {
      let query = `
        SELECT o.*, c.name as customer_name, p.name as product_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN products p ON o.product_id = p.id
      `;
      
      const params = [];
      if (status) {
        query += ' WHERE o.order_status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY o.order_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const orders = await this.allQuery(query, params);
      return orders;
    } catch (error) {
      console.error('Error getting orders:', error);
      throw error;
    }
  }

  // Inventory operations
  async recordInventoryMovement(product_id, movement_type, quantity, reason = '', reference_number = '') {
    try {
      const result = await this.runQuery(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, reference_number)
         VALUES (?, ?, ?, ?, ?)`,
        [product_id, movement_type, quantity, reason, reference_number]
      );
      
      return result.id;
    } catch (error) {
      console.error('Error recording inventory movement:', error);
      throw error;
    }
  }

  async getInventoryReport() {
    try {
      const report = await this.allQuery(`
        SELECT 
          p.id,
          p.name as product_name,
          p.stock_quantity,
          p.category,
          SUM(CASE WHEN im.movement_type = 'in' THEN im.quantity 
                   WHEN im.movement_type = 'out' THEN -im.quantity 
                   ELSE 0 END) as total_movements,
          COUNT(im.id) as movement_count
        FROM products p
        LEFT JOIN inventory_movements im ON p.id = im.product_id
        GROUP BY p.id, p.name, p.stock_quantity, p.category
        ORDER BY p.name
      `);
      
      return report;
    } catch (error) {
      console.error('Error getting inventory report:', error);
      throw error;
    }
  }

  // Utility methods for complex queries
  async getDashboardStats() {
    try {
      const stats = {};
      
      // Product stats
      stats.total_products = (await this.getQuery('SELECT COUNT(*) as count FROM products')).count;
      stats.active_products = (await this.getQuery('SELECT COUNT(*) as count FROM products WHERE is_active = 1')).count;
      
      // Customer stats
      stats.total_customers = (await this.getQuery('SELECT COUNT(*) as count FROM customers')).count;
      stats.vip_customers = (await this.getQuery('SELECT COUNT(*) as count FROM customers WHERE is_vip = 1')).count;
      
      // Order stats
      stats.total_orders = (await this.getQuery('SELECT COUNT(*) as count FROM orders')).count;
      stats.pending_orders = (await this.getQuery('SELECT COUNT(*) as count FROM orders WHERE order_status = "pending"')).count;
      stats.completed_orders = (await this.getQuery('SELECT COUNT(*) as count FROM orders WHERE order_status = "completed"')).count;
      
      // Revenue stats
      const revenue = await this.getQuery('SELECT SUM(total_price) as total FROM orders WHERE order_status = "completed"');
      stats.total_revenue = revenue.total || 0;
      
      return stats;
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
}

module.exports = DatabaseServiceExtension;