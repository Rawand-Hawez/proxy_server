require('dotenv').config();
const xmlrpc = require('xmlrpc');
const { URL } = require('url');

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USER = process.env.ODOO_USER;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

console.log('Testing Odoo Authentication...');
console.log('URL:', ODOO_URL);
console.log('DB:', ODOO_DB);
console.log('User:', ODOO_USER);
console.log('Password length:', ODOO_PASSWORD ? ODOO_PASSWORD.length : 0);
console.log('---');

const parsedUrl = new URL(ODOO_URL);
const basePath = parsedUrl.pathname || '/';
const normalizedPath = basePath.endsWith('/') ? basePath : `${basePath}/`;

console.log('Parsed URL:', {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
  protocol: parsedUrl.protocol,
  pathname: parsedUrl.pathname
});
console.log('---');

// Create client for common endpoint (authentication)
const clientOptions = {
  host: parsedUrl.hostname,
  port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
  path: `${normalizedPath}xmlrpc/2/common`
};

console.log('Client options:', clientOptions);
console.log('---');

const client = parsedUrl.protocol === 'https:'
  ? xmlrpc.createSecureClient(clientOptions)
  : xmlrpc.createClient(clientOptions);

console.log('Attempting authentication...');
client.methodCall('authenticate', [
  ODOO_DB,
  ODOO_USER,
  ODOO_PASSWORD,
  {}
], (error, uid) => {
  if (error) {
    console.error('Authentication ERROR:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    process.exit(1);
  } else if (!uid) {
    console.error('Authentication FAILED: Invalid credentials (uid is false/null)');
    console.error('Received uid:', uid);
    process.exit(1);
  } else {
    console.log('Authentication SUCCESS!');
    console.log('User ID:', uid);
    process.exit(0);
  }
});
