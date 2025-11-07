
-- Medical Colleges Table
CREATE TABLE IF NOT EXISTS colleges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  type TEXT NOT NULL,
  established_year INTEGER,
  rating REAL,
  total_seats INTEGER,
  stream TEXT NOT NULL,
  courses TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  level TEXT NOT NULL,
  stream TEXT NOT NULL,
  total_seats INTEGER,
  fee_min INTEGER,
  fee_max INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cutoffs Table
CREATE TABLE IF NOT EXISTS cutoffs (
  id TEXT PRIMARY KEY,
  college_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  opening_rank INTEGER NOT NULL,
  closing_rank INTEGER NOT NULL,
  year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  category TEXT NOT NULL,
  state TEXT NOT NULL,
  stream TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cutoffs_stream_round ON cutoffs(stream, round);
CREATE INDEX IF NOT EXISTS idx_cutoffs_college ON cutoffs(college_id);
CREATE INDEX IF NOT EXISTS idx_cutoffs_course ON cutoffs(course_id);
CREATE INDEX IF NOT EXISTS idx_cutoffs_rank ON cutoffs(opening_rank, closing_rank);
CREATE INDEX IF NOT EXISTS idx_colleges_stream ON colleges(stream);
CREATE INDEX IF NOT EXISTS idx_courses_stream ON courses(stream);
