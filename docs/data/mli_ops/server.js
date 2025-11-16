const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

// Database setup - use persistent volume for Coolify
const dbPath = process.env.DATABASE_PATH || './programs.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        initDatabase();
    }
});

// Initialize database schema
function initDatabase() {
    const sql = `
        CREATE TABLE IF NOT EXISTS programs (
            program TEXT PRIMARY KEY,
            number_of_participants REAL,
            male REAL,
            female REAL,
            trainers REAL,
            local_trainer REAL,
            expat_trainer REAL,
            duration_days REAL,
            unit_price REAL,
            total_revenue_input REAL,
            status TEXT,
            start_date TEXT,
            end_date TEXT,
            participant_fee REAL,
            non_monetary_revenue REAL,
            actual_revenue REAL
        )
    `;
    db.run(sql, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Programs table created or already exists.');
            // Migrate initial data if table is empty
            migrateInitialData();
        }
    });
}

// Migrate initial data from Excel
function migrateInitialData() {
    db.get("SELECT COUNT(*) as count FROM programs", (err, row) => {
        if (err) {
            console.error('Error checking data:', err.message);
        } else if (row.count === 0) {
            console.log('Migrating initial data from Excel...');
            try {
                const workbook = XLSX.readFile('MLI.xlsx');
                const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'programs');
                if (sheetName) {
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    const headers = json[0];
                    const rows = json.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((header, i) => {
                            let key = header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                            const mapping = {
                                'program': 'program',
                                'number_of_participants': 'number_of_participants',
                                'male': 'male',
                                'female': 'female',
                                'trainers': 'trainers',
                                'local_trainer': 'local_trainer',
                                'expat_trainer': 'expat_trainer',
                                'duration_/_days': 'duration_days',
                                'estimated_price_per_participant': 'unit_price',
                                'total_revenue': 'total_revenue_input'
                            };
                            key = mapping[key] || key;
                            let value = row[i];
                            if (value === 'TBC' || value === '-' || value === '') value = null;
                            if (typeof value === 'string' && /^\$?\d+[\d,]*\.?\d*$/.test(value)) value = parseFloat(value.replace(/[$,]/g, ''));
                            if (key === 'program' && value === 'Social Media Managemnt') value = 'Social Media Management';
                            obj[key] = value;
                        });
                        // Compute trainers
                        obj.trainers = (obj.local_trainer || 0) + (obj.expat_trainer || 0);
                        // Set status
                        obj.status = (obj.number_of_participants && obj.number_of_participants > 0) ? 'completed' : 'planned';
                        return obj;
                    });

                    const stmt = db.prepare(`
                        INSERT OR REPLACE INTO programs (
                            program, number_of_participants, male, female, trainers, local_trainer, expat_trainer,
                            duration_days, unit_price, total_revenue_input, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    rows.forEach(row => {
                        stmt.run([
                            row.program, row.number_of_participants, row.male, row.female, row.trainers,
                            row.local_trainer, row.expat_trainer, row.duration_days, row.unit_price,
                            row.total_revenue_input, row.status
                        ]);
                    });

                    stmt.finalize();
                    console.log('Initial data migrated.');
                }
            } catch (error) {
                console.error('Error migrating data:', error);
            }
        }
    });
}

// API Routes

// Get all programs
app.get('/api/programs', (req, res) => {
    db.all("SELECT * FROM programs", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Compute derived fields
        const derived = rows.map(row => {
            row.trainers = (row.local_trainer || 0) + (row.expat_trainer || 0);
            row.computed_revenue = (row.number_of_participants && row.participant_fee) ? row.number_of_participants * row.participant_fee : null;
            row.final_revenue = row.total_revenue_input ?? row.computed_revenue;
            row.revenue_overridden = row.total_revenue_input != null && Math.abs(row.total_revenue_input - row.computed_revenue) > 0.01;
            return row;
        });
        res.json(derived);
    });
});

// Add or update program
app.post('/api/programs', (req, res) => {
    const program = req.body;
    const sql = `
        INSERT OR REPLACE INTO programs (
            program, number_of_participants, male, female, trainers, local_trainer, expat_trainer,
            duration_days, unit_price, total_revenue_input, status, start_date, end_date,
            participant_fee, non_monetary_revenue, actual_revenue
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        program.program, program.number_of_participants, program.male, program.female,
        (program.local_trainer || 0) + (program.expat_trainer || 0), program.local_trainer, program.expat_trainer,
        program.duration_days, program.unit_price, program.total_revenue_input, program.status,
        program.start_date, program.end_date, program.participant_fee, program.non_monetary_revenue, program.actual_revenue
    ];
    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID });
    });
});

// Delete program
app.delete('/api/programs/:program', (req, res) => {
    const sql = "DELETE FROM programs WHERE program = ?";
    db.run(sql, req.params.program, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});

// Import from Excel
const upload = multer({ dest: 'uploads/' });
app.post('/api/import', upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'programs');
        if (!sheetName) {
            res.status(400).json({ error: 'Programs sheet not found' });
            return;
        }

        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const headers = json[0];
        const rows = json.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, i) => {
                let key = header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                const mapping = {
                    'program': 'program',
                    'number_of_participants': 'number_of_participants',
                    'male': 'male',
                    'female': 'female',
                    'trainers': 'trainers',
                    'local_trainer': 'local_trainer',
                    'expat_trainer': 'expat_trainer',
                    'duration_/_days': 'duration_days',
                    'estimated_price_per_participant': 'unit_price',
                    'total_revenue': 'total_revenue_input'
                };
                key = mapping[key] || key;
                let value = row[i];
                if (value === 'TBC' || value === '-' || value === '') value = null;
                if (typeof value === 'string' && /^\$?\d+[\d,]*\.?\d*$/.test(value)) value = parseFloat(value.replace(/[$,]/g, ''));
                if (key === 'program' && value === 'Social Media Managemnt') value = 'Social Media Management';
                obj[key] = value;
            });
            obj.trainers = (obj.local_trainer || 0) + (obj.expat_trainer || 0);
            obj.status = (obj.number_of_participants && obj.number_of_participants > 0) ? 'completed' : 'planned';
            return obj;
        });

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO programs (
                program, number_of_participants, male, female, trainers, local_trainer, expat_trainer,
                duration_days, unit_price, total_revenue_input, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        rows.forEach(row => {
            stmt.run([
                row.program, row.number_of_participants, row.male, row.female, row.trainers,
                row.local_trainer, row.expat_trainer, row.duration_days, row.unit_price,
                row.total_revenue_input, row.status
            ]);
        });

        stmt.finalize();
        res.json({ imported: rows.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear all programs
app.delete('/api/programs', (req, res) => {
    db.run("DELETE FROM programs", function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});