ALTER TABLE mli_ops_programs
ADD COLUMN venue_cost REAL DEFAULT 0.00;

ALTER TABLE mli_ops_programs
ADD COLUMN catering_cost REAL DEFAULT 0.00;

ALTER TABLE mli_ops_programs
ADD COLUMN materials_cost REAL DEFAULT 0.00;
