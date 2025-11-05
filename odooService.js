const xmlrpc = require('xmlrpc');
const url = require('url');

class OdooService {
  constructor(odooUrl, database, username, password) {
    this.odooUrl = odooUrl;
    this.database = database;
    this.username = username;
    this.password = password;
    this.uid = null;

    // Parse URL to get host, port, and path
    const parsedUrl = url.parse(odooUrl);
    this.host = parsedUrl.hostname;
    this.port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
    this.secure = parsedUrl.protocol === 'https:';
    this.path = parsedUrl.path || '/';
  }

  // Create XML-RPC client for common endpoint
  createClient(endpoint) {
    const clientOptions = {
      host: this.host,
      port: this.port,
      path: `${this.path}xmlrpc/2/${endpoint}`
    };

    return this.secure
      ? xmlrpc.createSecureClient(clientOptions)
      : xmlrpc.createClient(clientOptions);
  }

  // Authenticate and get user ID
  async authenticate() {
    if (this.uid) {
      return this.uid;
    }

    return new Promise((resolve, reject) => {
      const client = this.createClient('common');

      client.methodCall('authenticate', [
        this.database,
        this.username,
        this.password,
        {}
      ], (error, uid) => {
        if (error) {
          console.error('Odoo authentication error:', error);
          reject(error);
        } else if (!uid) {
          reject(new Error('Authentication failed - invalid credentials'));
        } else {
          this.uid = uid;
          console.log(`Odoo authenticated successfully. User ID: ${uid}`);
          resolve(uid);
        }
      });
    });
  }

  // Execute Odoo model method
  async execute(model, method, args = [], kwargs = {}) {
    try {
      const uid = await this.authenticate();

      return new Promise((resolve, reject) => {
        const client = this.createClient('object');

        client.methodCall('execute_kw', [
          this.database,
          uid,
          this.password,
          model,
          method,
          args,
          kwargs
        ], (error, result) => {
          if (error) {
            console.error(`Odoo execute error (${model}.${method}):`, error);
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }

  // Search and read records
  async searchRead(model, domain = [], fields = [], limit = 100, offset = 0) {
    return await this.execute(model, 'search_read', [domain], {
      fields: fields.length > 0 ? fields : undefined,
      limit,
      offset
    });
  }

  // Get partners (customers)
  async getPartners(limit = 100) {
    return await this.searchRead(
      'res.partner',
      [['customer_rank', '>', 0]],
      ['name', 'email', 'phone', 'city', 'country_id', 'customer_rank'],
      limit
    );
  }

  // Get sale orders with optional date filtering
  async getSaleOrders(limit = 100, startDate = null, endDate = null) {
    const domain = [['state', 'in', ['draft', 'sent', 'sale', 'done']]];

    if (startDate && endDate) {
      domain.push(['date_order', '>=', startDate]);
      domain.push(['date_order', '<=', endDate]);
    }

    return await this.searchRead(
      'sale.order',
      domain,
      ['name', 'partner_id', 'date_order', 'amount_total', 'state'],
      limit
    );
  }

  // Get invoices with optional date filtering
  async getInvoices(limit = 100, startDate = null, endDate = null) {
    const domain = [['move_type', '=', 'out_invoice']];

    if (startDate && endDate) {
      domain.push(['invoice_date', '>=', startDate]);
      domain.push(['invoice_date', '<=', endDate]);
    }

    return await this.searchRead(
      'account.move',
      domain,
      ['name', 'partner_id', 'invoice_date', 'amount_total', 'state', 'payment_state'],
      limit
    );
  }

  // Get POS orders with optional date filtering
  async getPosOrders(limit = 100, startDate = null, endDate = null) {
    const domain = [];

    if (startDate && endDate) {
      domain.push(['date_order', '>=', startDate]);
      domain.push(['date_order', '<=', endDate]);
    }

    return await this.searchRead(
      'pos.order',
      domain,
      ['name', 'partner_id', 'date_order', 'amount_total', 'state', 'session_id'],
      limit
    );
  }

  // Get POS payments with optional date filtering
  async getPosPayments(limit = 100, startDate = null, endDate = null) {
    const domain = [];

    if (startDate && endDate) {
      domain.push(['payment_date', '>=', startDate]);
      domain.push(['payment_date', '<=', endDate]);
    }

    return await this.searchRead(
      'pos.payment',
      domain,
      ['name', 'amount', 'payment_date', 'payment_method_id', 'pos_order_id'],
      limit
    );
  }

  // Get POS summary (aggregated data) with optional date filtering
  async getPosSummary(startDate = null, endDate = null) {
    try {
      const domain = [['state', '=', 'paid']];

      if (startDate && endDate) {
        domain.push(['date_order', '>=', startDate]);
        domain.push(['date_order', '<=', endDate]);
      }

      const orders = await this.searchRead(
        'pos.order',
        domain,
        ['amount_total'],
        5000
      );

      const totalRevenue = orders.reduce((sum, order) => sum + (order.amount_total || 0), 0);
      const totalOrders = orders.length;

      return {
        success: true,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        ...(startDate && endDate && {
          date_range: {
            start: startDate,
            end: endDate
          }
        })
      };
    } catch (error) {
      throw error;
    }
  }

  // Get POS order items (lines)
  async getPosOrderItems(orderId, limit = 100) {
    return await this.searchRead(
      'pos.order.line',
      [['order_id', '=', parseInt(orderId)]],
      ['product_id', 'qty', 'price_unit', 'price_subtotal', 'price_subtotal_incl'],
      limit
    );
  }

  // Get stock levels (inventory)
  async getStockLevels(limit = 100) {
    try {
      // Try stock.quant first
      return await this.searchRead(
        'stock.quant',
        [['quantity', '>', 0]],
        ['product_id', 'location_id', 'quantity', 'reserved_quantity'],
        limit
      );
    } catch (error) {
      // Fallback to product.product
      console.log('Falling back to product.product for stock levels');
      return await this.searchRead(
        'product.product',
        [],
        ['name', 'qty_available', 'virtual_available'],
        limit
      );
    }
  }

  // Get stock movements
  async getStockMovements(limit = 100) {
    return await this.searchRead(
      'stock.move',
      [['state', '=', 'done']],
      ['name', 'product_id', 'product_uom_qty', 'location_id', 'location_dest_id', 'date'],
      limit
    );
  }

  // Get stock pickings (transfers)
  async getStockPickings(limit = 100) {
    return await this.searchRead(
      'stock.picking',
      [],
      ['name', 'partner_id', 'scheduled_date', 'state', 'picking_type_id', 'location_id', 'location_dest_id'],
      limit
    );
  }

  // Get inventory summary
  async getInventorySummary(groupBy = 'product', limit = 100) {
    try {
      if (groupBy === 'location') {
        const quants = await this.searchRead(
          'stock.quant',
          [['quantity', '>', 0]],
          ['location_id', 'quantity'],
          limit
        );

        const summary = {};
        quants.forEach(quant => {
          const locationKey = quant.location_id ? quant.location_id[1] : 'Unknown';
          if (!summary[locationKey]) {
            summary[locationKey] = 0;
          }
          summary[locationKey] += quant.quantity || 0;
        });

        return Object.keys(summary).map(location => ({
          location,
          total_quantity: summary[location]
        }));
      } else {
        // Group by product (default)
        const quants = await this.searchRead(
          'stock.quant',
          [['quantity', '>', 0]],
          ['product_id', 'quantity'],
          limit
        );

        const summary = {};
        quants.forEach(quant => {
          const productKey = quant.product_id ? quant.product_id[1] : 'Unknown';
          if (!summary[productKey]) {
            summary[productKey] = 0;
          }
          summary[productKey] += quant.quantity || 0;
        });

        return Object.keys(summary).map(product => ({
          product,
          total_quantity: summary[product]
        }));
      }
    } catch (error) {
      throw error;
    }
  }

  // Get dashboard metrics
  async getDashboard() {
    try {
      const [partners, saleOrders, invoices, posOrders] = await Promise.all([
        this.searchRead('res.partner', [['customer_rank', '>', 0]], ['id'], 10000),
        this.searchRead('sale.order', [['state', 'in', ['sale', 'done']]], ['amount_total'], 10000),
        this.searchRead('account.move', [['move_type', '=', 'out_invoice'], ['state', '=', 'posted']], ['amount_total'], 10000),
        this.searchRead('pos.order', [['state', '=', 'paid']], ['amount_total'], 10000)
      ]);

      const saleRevenue = saleOrders.reduce((sum, order) => sum + (order.amount_total || 0), 0);
      const invoiceRevenue = invoices.reduce((sum, inv) => sum + (inv.amount_total || 0), 0);
      const posRevenue = posOrders.reduce((sum, order) => sum + (order.amount_total || 0), 0);

      return {
        success: true,
        customers: partners.length,
        sale_orders: saleOrders.length,
        sale_revenue: saleRevenue,
        invoices: invoices.length,
        invoice_revenue: invoiceRevenue,
        pos_orders: posOrders.length,
        pos_revenue: posRevenue,
        total_revenue: saleRevenue + posRevenue
      };
    } catch (error) {
      throw error;
    }
  }

  // Generic method to access any model
  async getModel(modelName, domain = [], fields = [], limit = 100) {
    return await this.searchRead(modelName, domain, fields, limit);
  }
}

module.exports = OdooService;
