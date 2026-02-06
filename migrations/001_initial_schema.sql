-- Shift Planning Tool - Initial Database Schema
-- Created: 2025-12-30

BEGIN;

-- People table (pseudonymised)
CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  alias VARCHAR(100) UNIQUE NOT NULL,
  avatar_path VARCHAR(255),
  role VARCHAR(50),
  experience_level VARCHAR(20) NOT NULL, -- 'junior', 'intermediate', 'senior', 'lead'
  gender_tag VARCHAR(20), -- TODO: Sensitive feature - discuss implementation approach
  is_shift_lead BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Shifts table
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  shift_type VARCHAR(50) NOT NULL, -- 'mobile_1', 'mobile_2', 'stationary', 'SUPER'
  priority INTEGER DEFAULT 0, -- Higher = more important (core event = highest)
  is_core_event BOOLEAN DEFAULT FALSE, -- Thursday-Monday midday
  required_people INTEGER NOT NULL, -- 1 or 2
  requires_shift_lead BOOLEAN DEFAULT FALSE, -- For stationary shift
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_shift_type CHECK (shift_type IN ('mobile_1', 'mobile_2', 'stationary', 'SUPER')),
  CONSTRAINT check_required_people CHECK (required_people IN (1, 2))
);

-- Shift preferences (user wishes)
CREATE TABLE shift_preferences (
  id SERIAL PRIMARY KEY,
  person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
  preference_score INTEGER DEFAULT 0, -- User's wish/preference (-10 to 10)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(person_id, shift_id),
  CONSTRAINT check_preference_score CHECK (preference_score >= -10 AND preference_score <= 10)
);

-- Shift assignments
CREATE TABLE shift_assignments (
  id SERIAL PRIMARY KEY,
  person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
  assigned_by VARCHAR(100), -- 'algorithm' or 'admin'
  assigned_at TIMESTAMP DEFAULT NOW(),
  is_manual_swap BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(person_id, shift_id)
);

-- Audit log (all database changes logged here)
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  record_id INTEGER,
  old_data JSONB,
  new_data JSONB,
  user_identifier VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Indexes for performance
CREATE INDEX idx_shifts_start_time ON shifts(start_time);
CREATE INDEX idx_shifts_priority ON shifts(priority DESC);
CREATE INDEX idx_shifts_core_event ON shifts(is_core_event) WHERE is_core_event = TRUE;
CREATE INDEX idx_assignments_person ON shift_assignments(person_id);
CREATE INDEX idx_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX idx_preferences_person ON shift_preferences(person_id);
CREATE INDEX idx_preferences_shift ON shift_preferences(shift_id);
CREATE INDEX idx_audit_table_time ON audit_log(table_name, timestamp DESC);

COMMIT;

