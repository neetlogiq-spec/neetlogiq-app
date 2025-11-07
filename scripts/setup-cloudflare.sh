#!/bin/bash

# NeetLogIQ Cloudflare Setup Script
# Sets up all necessary Cloudflare resources for the backend

set -e

echo "🚀 Setting up NeetLogIQ Cloudflare Resources..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    print_error "Please login to Cloudflare first:"
    echo "wrangler login"
    exit 1
fi

print_status "Creating R2 bucket for data storage..."
if wrangler r2 bucket create neetlogiq-data; then
    print_success "R2 bucket 'neetlogiq-data' created"
else
    print_warning "R2 bucket might already exist"
fi

print_status "Creating D1 database for admin data..."
DB_ID=$(wrangler d1 create neetlogiq-admin --json | jq -r '.id')
if [ "$DB_ID" != "null" ]; then
    print_success "D1 database created with ID: $DB_ID"
    
    # Update wrangler.toml with the actual database ID
    sed -i.bak "s/your-d1-database-id/$DB_ID/g" wrangler.toml
    print_success "Updated wrangler.toml with database ID"
else
    print_error "Failed to create D1 database"
    exit 1
fi

print_status "Creating Vectorize index for semantic search..."
if wrangler vectorize create neetlogiq-vectors --dimensions=768 --metric=cosine --description="NeetLogIQ content embeddings"; then
    print_success "Vectorize index 'neetlogiq-vectors' created"
else
    print_warning "Vectorize index might already exist"
fi

print_status "Setting up D1 database schema..."
# Create the database schema
cat > temp_schema.sql << 'EOF'
-- NeetLogIQ Database Schema

CREATE TABLE IF NOT EXISTS colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    management_type TEXT,
    established_year INTEGER,
    website TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stream TEXT,
    branch TEXT,
    duration_years INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS college_courses (
    id TEXT PRIMARY KEY,
    college_id TEXT REFERENCES colleges(id),
    course_id TEXT REFERENCES courses(id),
    year INTEGER,
    total_seats INTEGER,
    general_seats INTEGER,
    obc_seats INTEGER,
    sc_seats INTEGER,
    st_seats INTEGER,
    ews_seats INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cutoffs (
    id TEXT PRIMARY KEY,
    college_id TEXT REFERENCES colleges(id),
    course_id TEXT REFERENCES courses(id),
    year INTEGER,
    round INTEGER,
    category TEXT,
    opening_rank INTEGER,
    closing_rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publish_metadata (
    year INTEGER PRIMARY KEY,
    published_at TIMESTAMP,
    version_hash TEXT,
    status TEXT CHECK(status IN ('draft', 'validating', 'published', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_documents (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('college', 'course', 'cutoff')),
    year INTEGER,
    content TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    event_data JSON,
    user_id TEXT,
    session_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state);
CREATE INDEX IF NOT EXISTS idx_colleges_management_type ON colleges(management_type);
CREATE INDEX IF NOT EXISTS idx_courses_stream ON courses(stream);
CREATE INDEX IF NOT EXISTS idx_courses_branch ON courses(branch);
CREATE INDEX IF NOT EXISTS idx_college_courses_year ON college_courses(year);
CREATE INDEX IF NOT EXISTS idx_cutoffs_year ON cutoffs(year);
CREATE INDEX IF NOT EXISTS idx_cutoffs_college_course ON cutoffs(college_id, course_id);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);
EOF

# Apply the schema
if wrangler d1 execute neetlogiq-admin --file=temp_schema.sql; then
    print_success "Database schema created successfully"
else
    print_error "Failed to create database schema"
    exit 1
fi

# Clean up temp file
rm temp_schema.sql

print_status "Creating sample data..."
# Insert some sample data
cat > temp_sample_data.sql << 'EOF'
-- Sample data for testing
INSERT OR IGNORE INTO colleges (id, name, city, state, management_type, description) VALUES
('college_001', 'All India Institute of Medical Sciences', 'New Delhi', 'Delhi', 'Government', 'Premier medical institute in India'),
('college_002', 'Christian Medical College', 'Vellore', 'Tamil Nadu', 'Private', 'Renowned private medical college'),
('college_003', 'Armed Forces Medical College', 'Pune', 'Maharashtra', 'Government', 'Military medical college');

INSERT OR IGNORE INTO courses (id, name, stream, branch, description) VALUES
('course_001', 'MBBS', 'Medical', 'General Medicine', 'Bachelor of Medicine and Bachelor of Surgery'),
('course_002', 'MD', 'Medical', 'Internal Medicine', 'Doctor of Medicine in Internal Medicine'),
('course_003', 'MS', 'Medical', 'General Surgery', 'Master of Surgery in General Surgery');

INSERT OR IGNORE INTO college_courses (id, college_id, course_id, year, total_seats, general_seats, obc_seats, sc_seats, st_seats, ews_seats) VALUES
('cc_001', 'college_001', 'course_001', 2024, 100, 50, 27, 15, 7, 10),
('cc_002', 'college_002', 'course_001', 2024, 150, 75, 40, 22, 11, 15),
('cc_003', 'college_003', 'course_001', 2024, 120, 60, 32, 18, 9, 12);

INSERT OR IGNORE INTO cutoffs (id, college_id, course_id, year, round, category, opening_rank, closing_rank) VALUES
('cutoff_001', 'college_001', 'course_001', 2024, 1, 'General', 1, 50),
('cutoff_002', 'college_002', 'course_001', 2024, 1, 'General', 51, 125),
('cutoff_003', 'college_003', 'course_001', 2024, 1, 'General', 126, 185);
EOF

if wrangler d1 execute neetlogiq-admin --file=temp_sample_data.sql; then
    print_success "Sample data inserted successfully"
else
    print_error "Failed to insert sample data"
    exit 1
fi

# Clean up temp file
rm temp_sample_data.sql

print_status "Setting up AutoRAG project..."
# Note: AutoRAG setup might need to be done through the dashboard
print_warning "Please set up AutoRAG project manually through the Cloudflare dashboard:"
echo "1. Go to Cloudflare Dashboard > Workers & Pages > AutoRAG"
echo "2. Create a new project"
echo "3. Configure data source to point to R2 bucket 'neetlogiq-data'"
echo "4. Set up indexing for the 'docs/' prefix"

print_status "Deploying Workers..."
if wrangler deploy; then
    print_success "Workers deployed successfully"
else
    print_error "Failed to deploy Workers"
    exit 1
fi

print_status "Setting up environment variables..."
# Create .env.local file with configuration
cat > .env.local << EOF
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=$(wrangler whoami | grep -o 'Account ID: [^[:space:]]*' | cut -d' ' -f3)
CLOUDFLARE_API_TOKEN=your_api_token_here

# Database
D1_DATABASE_ID=$DB_ID

# Vectorize
VECTORIZE_INDEX_NAME=neetlogiq-vectors

# R2 Storage
R2_BUCKET_NAME=neetlogiq-data

# Next.js
NEXTAUTH_URL=http://localhost:3500
NEXTAUTH_SECRET=your_nextauth_secret_here

# Development
NODE_ENV=development
PORT=3500
EOF

print_success "Environment file created: .env.local"
print_warning "Please update .env.local with your actual API tokens and secrets"

print_status "Creating data directories..."
mkdir -p data/raw
mkdir -p data/processed/parquet
mkdir -p data/processed/json
mkdir -p data/processed/docs

print_success "Data directories created"

print_status "Setup complete! 🎉"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your actual configuration values"
echo "2. Place your Excel files in the data/raw/ directory"
echo "3. Run: npm run data:pipeline (to process your data)"
echo "4. Run: npm run dev (to start development server)"
echo ""
echo "Resources created:"
echo "✅ R2 bucket: neetlogiq-data"
echo "✅ D1 database: neetlogiq-admin (ID: $DB_ID)"
echo "✅ Vectorize index: neetlogiq-vectors"
echo "✅ Workers deployed"
echo "✅ Database schema created"
echo "✅ Sample data inserted"
echo ""
echo "Don't forget to set up AutoRAG through the Cloudflare dashboard!"
