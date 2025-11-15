# Web Interface & Database Management Guide

## 📋 **Current Status: FULLY IMPLEMENTED**

Your database and web interface are **completely implemented** and ready to use!

### ✅ **What's Available Right Now:**

1. **Database Service** (`databaseService.js`) - 6 built-in tables with full CRUD operations
2. **Web Admin Interface** (`webInterface.js`) - Professional dashboard for data management
3. **Admin API Endpoints** - Built into your main server.js for data operations
4. **Web Interface Integration** - Ready to plug into your main server

---

## 🗄️ **Current Database Tables**

Your database currently has these 6 tables:

| Table | Purpose | CRUD Support |
|-------|---------|-------------|
| `api_cache` | Cache API responses | ✅ Yes |
| `custom_data` | General purpose storage | ✅ Yes |
| `api_logs` | API call logging | ✅ Yes |
| `app_config` | Configuration storage | ✅ Yes |
| `user_sessions` | Session management | ✅ Yes |
| `sync_logs` | Data sync tracking | ✅ Yes |

---

## 📝 **How to Add New Tables**

### **Step 1: Add Table Definition**
Edit `databaseService.js`, add to the `tables` array in `createTables()` method:

```javascript
const tables = [
  // ... existing tables ...
  
  // Add your new table here:
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];
```

### **Step 2: Add CRUD Methods**
Add methods to the `DatabaseService` class:

```javascript
// Add to databaseService.js class
async createProduct(productData) {
  const result = await this.runQuery(
    `INSERT INTO products (name, description, price, category, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [productData.name, productData.description, productData.price, productData.category]
  );
  return result.id;
}

async getProducts(limit = 100, offset = 0) {
  return await this.allQuery(
    `SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

async updateProduct(id, productData) {
  const updates = Object.keys(productData).map(key => `${key} = ?`).join(', ');
  const params = [...Object.values(productData), id];
  
  const result = await this.runQuery(
    `UPDATE products SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    params
  );
  return result.changes > 0;
}

async deleteProduct(id) {
  const result = await this.runQuery(`DELETE FROM products WHERE id = ?`, [id]);
  return result.changes > 0;
}
```

---

## 🌐 **Web Interface Features**

Your web interface (`webInterface.js`) includes:

### **Dashboard Sections:**
- 📊 **System Overview** - Database stats, cache performance, system health
- 📝 **Custom Data Management** - Add/edit/delete records with JSON editor
- 🗃️ **Cache Statistics** - Redis and database cache monitoring
- 📋 **API Logs** - Real-time API call monitoring
- ⚙️ **Configuration** - App settings management

### **Key Features:**
- ✅ **Authentication** - Uses your existing ADMIN_TOKEN
- ✅ **Real-time Data** - Live updates and statistics
- ✅ **JSON Editor** - Easy record creation and editing
- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **REST API** - Full CRUD operations via HTTP endpoints

---

## 🔌 **Integration with Main Server**

### **Option 1: Separate Web Interface (Recommended)**
Create a new admin server instance:

```javascript
// Create admin-server.js
const WebInterface = require('./webInterface');
const DatabaseService = require('./databaseService');

async function startAdminServer() {
  // Initialize database
  const db = new DatabaseService('./data/proxy_server.db');
  await db.initialize();
  
  // Start web interface on port 3001
  const webInterface = new WebInterface(db, process.env.ADMIN_TOKEN);
  await webInterface.start(3001);
  
  console.log('🌐 Admin Web Interface: http://localhost:3001/admin');
}

// Run separately: node admin-server.js
```

### **Option 2: Integrate into Main Server**
Add to your `server.js`:

```javascript
// Add at top of server.js
const WebInterface = require('./webInterface');

// Add after services initialization
const webInterface = new WebInterface(databaseService, ADMIN_TOKEN);

// Add as admin route in server.js
app.use('/admin', webInterface.app);
```

---

## 📡 **Available API Endpoints**

Your system already has these admin endpoints:

### **Custom Data Management:**
- `GET /admin/custom-data` - List all custom records
- `POST /admin/custom-data` - Create new record
- `PUT /admin/custom-data/:id` - Update record
- `DELETE /admin/custom-data/:id` - Delete record

### **Configuration Management:**
- `GET /admin/db/config` - Get all configs
- `POST /admin/db/config` - Set config value

### **Cache Management:**
- `GET /admin/cache/stats` - Get cache statistics
- `POST /admin/cache/clear` - Clear cache entries
- `GET /admin/cache/health` - Health check

### **System Monitoring:**
- `GET /admin/status` - System status
- `GET /admin/logs` - API logs
- `GET /admin` - Web interface

---

## 🚀 **Quick Start Examples**

### **1. Access Web Interface**
```bash
# Start your main server
npm start

# Open in browser
http://localhost:3000/admin
```

### **2. Add Data via Web Interface**
1. Click **"Custom Data"** tab
2. Click **"➕ Add New Record"**
3. Fill form:
   - **Table Name**: `products`
   - **Record Data**: 
   ```json
   {
     "name": "Laptop",
     "description": "High-performance laptop",
     "price": 999.99,
     "category": "Electronics"
   }
   ```
4. Click **"💾 Save Record"**

### **3. Add Data via API**
```bash
# Create product via API
curl -X POST http://localhost:3000/admin/custom-data \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableName": "products",
    "recordData": {
      "name": "Smartphone",
      "description": "Latest model smartphone",
      "price": 699.99,
      "category": "Electronics"
    }
  }'
```

### **4. View Data via API**
```bash
# Get all products
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/admin/custom-data?table=products
```

---

## 🔧 **Adding Custom Tables Example**

### **Create a "customers" table:**

**Step 1: Add to databaseService.js**
```javascript
// In createTables() method, add:
`CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`
```

**Step 2: Add CRUD methods**
```javascript
// Add to DatabaseService class
async createCustomer(customerData) {
  const result = await this.runQuery(
    `INSERT INTO customers (name, email, phone, address, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [customerData.name, customerData.email, customerData.phone, customerData.address]
  );
  return result.id;
}

async getCustomers(limit = 100, offset = 0) {
  return await this.allQuery(
    `SELECT * FROM customers ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}
```

**Step 3: Use via Web Interface**
1. Go to **Custom Data** tab
2. Add new record with:
   - **Table Name**: `customers`
   - **Record Data**:
   ```json
   {
     "name": "John Doe",
     "email": "john@example.com",
     "phone": "+1234567890",
     "address": "123 Main St"
   }
   ```

---

## 🎯 **Best Practices**

### **Data Structure:**
- Use **JSON** for flexible data storage
- Include **timestamps** (`created_at`, `updated_at`)
- Add **active/inactive** flags for soft deletes
- Use **unique identifiers** (email, SKU, etc.)

### **Security:**
- All admin endpoints require **Bearer token authentication**
- Use **HTTPS** in production
- Keep **ADMIN_TOKEN** secure and rotate regularly
- Implement **rate limiting** (already included)

### **Performance:**
- Use **caching** for frequently accessed data
- Implement **pagination** for large datasets
- Monitor **database size** and cleanup old logs
- Use **Redis** for session storage (already configured)

---

## 📱 **Mobile-Friendly Interface**

The web interface is fully responsive and works on:
- ✅ **Desktop** - Full feature set
- ✅ **Tablet** - Optimized layout
- ✅ **Mobile** - Touch-friendly controls

---

## 🛠️ **Troubleshooting**

### **Database Connection Issues:**
```bash
# Check database file exists
ls -la data/proxy_server.db

# Check permissions
chmod 664 data/proxy_server.db
```

### **Admin Interface Not Loading:**
```bash
# Verify admin token is set
echo $ADMIN_TOKEN

# Check port availability
netstat -an | grep 3000
```

### **API Returns 401 Unauthorized:**
```bash
# Verify correct header format
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/admin/status
```

---

## 🎉 **Summary**

**Your system is ready to use!**

✅ **Database**: 6 built-in tables with full CRUD  
✅ **Web Interface**: Professional admin dashboard  
✅ **API Endpoints**: RESTful data management  
✅ **Authentication**: Secure token-based access  
✅ **Real-time**: Live statistics and monitoring  
✅ **Extensible**: Easy to add new tables and features  

**Next Steps:**
1. **Start your server**: `npm start`
2. **Access admin interface**: `http://localhost:3000/admin`
3. **Add your first records** using the web interface or API
4. **Extend database** by following the examples above