#!/usr/bin/env node

/**
 * Database Setup Script for NeetLogIQ
 * Sets up DuckDB + Parquet integration
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up NeetLogIQ Database...\n');

// Check if data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  console.log('📁 Creating data directory...');
  fs.mkdirSync(dataDir, { recursive: true });
}

// Check for Parquet files
const collegesPath = path.join(dataDir, 'colleges.parquet');
const coursesPath = path.join(dataDir, 'courses.parquet');
const cutoffsPath = path.join(dataDir, 'cutoffs.parquet');

console.log('📊 Checking for Parquet files...');

if (fs.existsSync(collegesPath) && fs.existsSync(coursesPath)) {
  console.log('✅ Parquet files found!');
  console.log(`   - Colleges: ${fs.statSync(collegesPath).size} bytes`);
  console.log(`   - Courses: ${fs.statSync(coursesPath).size} bytes`);
  if (fs.existsSync(cutoffsPath)) {
    console.log(`   - Cutoffs: ${fs.statSync(cutoffsPath).size} bytes`);
  }
} else {
  console.log('⚠️ Parquet files not found. Creating sample data...');
  
  // Create sample Parquet files (simplified)
  const sampleColleges = [
    {
      id: 1,
      name: 'All India Institute of Medical Sciences, New Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      stream: 'Medical',
      management_type: 'GOVERNMENT',
      total_seats: 100,
      cutoff_rank: 50,
      fees: 1000,
      rating: 5.0,
      description: 'Premier medical institute in India',
      website: 'https://www.aiims.edu',
      phone: '+91-11-26588500',
      email: 'info@aiims.edu',
      address: 'Ansari Nagar, New Delhi - 110029',
      established_year: 1956,
      affiliation: 'AIIMS',
      recognition: 'MCI'
    },
    {
      id: 2,
      name: 'Maulana Azad Medical College',
      city: 'New Delhi',
      state: 'Delhi',
      stream: 'Medical',
      management_type: 'GOVERNMENT',
      total_seats: 150,
      cutoff_rank: 200,
      fees: 1000,
      rating: 4.8,
      description: 'Government medical college in Delhi',
      website: 'https://www.mamc.ac.in',
      phone: '+91-11-23239271',
      email: 'info@mamc.ac.in',
      address: 'Bahadur Shah Zafar Marg, New Delhi - 110002',
      established_year: 1956,
      affiliation: 'Delhi University',
      recognition: 'MCI'
    }
  ];

  const sampleCourses = [
    {
      id: 1,
      name: 'MBBS',
      stream: 'Medical',
      branch: 'UG',
      duration: '5.5 years',
      degree_type: 'MEDICAL',
      total_seats: 100,
      cutoff_rank: 50,
      fees: 1000,
      college_id: 1,
      college_name: 'All India Institute of Medical Sciences, New Delhi',
      description: 'Bachelor of Medicine and Bachelor of Surgery',
      eligibility: '10+2 with Physics, Chemistry, Biology',
      syllabus: 'Anatomy, Physiology, Biochemistry, Pathology, Medicine, Surgery',
      career_prospects: 'Doctor, Medical Officer, Specialist'
    },
    {
      id: 2,
      name: 'BDS',
      stream: 'Dental',
      branch: 'UG',
      duration: '5 years',
      degree_type: 'DENTAL',
      total_seats: 50,
      cutoff_rank: 200,
      fees: 1000,
      college_id: 2,
      college_name: 'Maulana Azad Medical College',
      description: 'Bachelor of Dental Surgery',
      eligibility: '10+2 with Physics, Chemistry, Biology',
      syllabus: 'Oral Anatomy, Dental Materials, Prosthodontics, Orthodontics',
      career_prospects: 'Dentist, Oral Surgeon, Dental Specialist'
    }
  ];

  const sampleCutoffs = [
    {
      id: 1,
      college_id: 1,
      college_name: 'All India Institute of Medical Sciences, New Delhi',
      course_id: 1,
      course_name: 'MBBS',
      year: 2024,
      category: 'General',
      opening_rank: 1,
      closing_rank: 50,
      round: 1,
      state: 'Delhi',
      quota: 'General',
      seat_type: 'General'
    },
    {
      id: 2,
      college_id: 2,
      college_name: 'Maulana Azad Medical College',
      course_id: 2,
      course_name: 'BDS',
      year: 2024,
      category: 'General',
      opening_rank: 100,
      closing_rank: 200,
      round: 1,
      state: 'Delhi',
      quota: 'General',
      seat_type: 'General'
    }
  ];

  // Write sample data as JSON (for now, in production this would be Parquet)
  fs.writeFileSync(path.join(dataDir, 'colleges.json'), JSON.stringify(sampleColleges, null, 2));
  fs.writeFileSync(path.join(dataDir, 'courses.json'), JSON.stringify(sampleCourses, null, 2));
  fs.writeFileSync(path.join(dataDir, 'cutoffs.json'), JSON.stringify(sampleCutoffs, null, 2));
  
  console.log('✅ Sample data created!');
  console.log(`   - Colleges: ${sampleColleges.length} records`);
  console.log(`   - Courses: ${sampleCourses.length} records`);
  console.log(`   - Cutoffs: ${sampleCutoffs.length} records`);
}

// Create environment file template
const envTemplate = `# NeetLogIQ Environment Configuration

# Database Configuration
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=neetlogiq-data
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# AutoRAG Configuration
NEXT_PUBLIC_AUTORAG_URL=https://api.cloudflare.com/client/v4/accounts
NEXT_PUBLIC_AUTORAG_API_KEY=your_cloudflare_api_key
NEXT_PUBLIC_AUTORAG_INDEX=neetlogiq-vectors
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3500
`;

const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating environment file template...');
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Environment file created: .env.local');
  console.log('   Please update with your actual configuration values');
}

console.log('\n🎉 Database setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Update .env.local with your configuration');
console.log('2. Run: npm run db:migrate (if you have real data)');
console.log('3. Run: npm run dev (to start development server)');
console.log('\n🚀 Ready to go!');
