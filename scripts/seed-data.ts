#!/usr/bin/env tsx

/**
 * Data Seeding Script for Development
 * Populates local database with comprehensive sample data
 */

import { createLocalEnv } from '../src/lib/local-cloudflare';
import { College, Course, Cutoff } from '../src/types/index';

const env = createLocalEnv();

// Sample data that matches real Indian medical colleges
const sampleColleges: Partial<College>[] = [
  {
    id: 'aiims_delhi_001',
    name: 'All India Institute of Medical Sciences, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    type: 'MEDICAL',
    stream: 'Medical',
    management_type: 'GOVERNMENT',
    established_year: 1956,
    website: 'https://www.aiims.edu',
    phone: '+91-11-26588500',
    email: 'info@aiims.edu',
    description: 'Premier medical institute in India, established in 1956. Known for excellence in medical education, research, and patient care.',
    rating: 4.8,
    total_seats: 125,
    cutoff_rank: 1,
    fees: 1000,
    placement_percentage: 100,
    nirf_ranking: 1,
    is_government: true,
    is_private: false,
    is_trust: false,
    affiliation: 'Deemed University',
    recognition: 'MCI',
    university_affiliation: 'AIIMS'
  },
  {
    id: 'mamc_delhi_002',
    name: 'Maulana Azad Medical College',
    city: 'New Delhi',
    state: 'Delhi',
    type: 'MEDICAL',
    stream: 'Medical',
    management_type: 'GOVERNMENT',
    established_year: 1958,
    website: 'https://www.mamc.ac.in',
    phone: '+91-11-23239271',
    email: 'info@mamc.ac.in',
    description: 'One of the oldest and most prestigious medical colleges in Delhi, affiliated with University of Delhi.',
    rating: 4.5,
    total_seats: 250,
    cutoff_rank: 85,
    fees: 5000,
    placement_percentage: 95,
    nirf_ranking: 15,
    is_government: true,
    is_private: false,
    is_trust: false,
    affiliation: 'University of Delhi',
    recognition: 'MCI',
    university_affiliation: 'Delhi University'
  },
  {
    id: 'lhmc_delhi_003',
    name: 'Lady Hardinge Medical College',
    city: 'New Delhi',
    state: 'Delhi',
    type: 'MEDICAL',
    stream: 'Medical',
    management_type: 'GOVERNMENT',
    established_year: 1916,
    website: 'https://www.lhmc.ac.in',
    phone: '+91-11-23388444',
    email: 'info@lhmc.ac.in',
    description: 'Historic medical college for women, now co-educational. Known for comprehensive medical education.',
    rating: 4.3,
    total_seats: 200,
    cutoff_rank: 120,
    fees: 4500,
    placement_percentage: 92,
    nirf_ranking: 25,
    is_government: true,
    is_private: false,
    is_trust: false,
    affiliation: 'University of Delhi',
    recognition: 'MCI',
    university_affiliation: 'Delhi University'
  },
  {
    id: 'kmc_manipal_004',
    name: 'Kasturba Medical College, Manipal',
    city: 'Manipal',
    state: 'Karnataka',
    type: 'MEDICAL',
    stream: 'Medical',
    management_type: 'PRIVATE',
    established_year: 1953,
    website: 'https://www.manipal.edu',
    phone: '+91-820-2922327',
    email: 'info@manipal.edu',
    description: 'Premier private medical college with excellent infrastructure and international collaborations.',
    rating: 4.4,
    total_seats: 300,
    cutoff_rank: 200,
    fees: 2500000,
    placement_percentage: 90,
    nirf_ranking: 8,
    is_government: false,
    is_private: true,
    is_trust: false,
    affiliation: 'Manipal Academy of Higher Education',
    recognition: 'MCI',
    university_affiliation: 'MAHE'
  },
  {
    id: 'cmc_vellore_005',
    name: 'Christian Medical College, Vellore',
    city: 'Vellore',
    state: 'Tamil Nadu',
    type: 'MEDICAL',
    stream: 'Medical',
    management_type: 'TRUST',
    established_year: 1918,
    website: 'https://www.cmch-vellore.edu',
    phone: '+91-416-2284267',
    email: 'info@cmch-vellore.edu',
    description: 'One of Indias top medical colleges, known for compassionate healthcare and medical education.',
    rating: 4.7,
    total_seats: 100,
    cutoff_rank: 50,
    fees: 750000,
    placement_percentage: 98,
    nirf_ranking: 3,
    is_government: false,
    is_private: false,
    is_trust: true,
    affiliation: 'Deemed University',
    recognition: 'MCI',
    university_affiliation: 'CMC'
  },
  {
    id: 'bhu_varanasi_006',
    name: 'Institute of Medical Sciences, BHU',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    type: 'MEDICAL',
    stream: 'Medical',
    management_type: 'GOVERNMENT',
    established_year: 1960,
    website: 'https://www.bhu.ac.in',
    phone: '+91-542-2369636',
    email: 'info@bhu.ac.in',
    description: 'Part of Banaras Hindu University, offering comprehensive medical education with research focus.',
    rating: 4.2,
    total_seats: 180,
    cutoff_rank: 300,
    fees: 8000,
    placement_percentage: 85,
    nirf_ranking: 18,
    is_government: true,
    is_private: false,
    is_trust: false,
    affiliation: 'Banaras Hindu University',
    recognition: 'MCI',
    university_affiliation: 'BHU'
  }
];

const sampleCourses: Partial<Course>[] = [
  {
    id: 'mbbs_001',
    name: 'MBBS (Bachelor of Medicine and Bachelor of Surgery)',
    stream: 'Medical',
    branch: 'UG',
    duration: '66 months',
    duration_years: 5.5,
    degree_type: 'MEDICAL',
    total_seats: 1000,
    cutoff_rank: 1,
    fees: 500000,
    eligibility: 'NEET qualified with Physics, Chemistry, Biology',
    description: 'Primary undergraduate degree in medicine. Comprehensive program covering all aspects of medical science.',
    college_id: 'aiims_delhi_001',
    college_name: 'All India Institute of Medical Sciences, New Delhi',
    syllabus: 'Pre-clinical, Para-clinical, and Clinical subjects over 4.5 years plus 1 year internship',
    career_prospects: 'Medical Officer, Specialist Doctor, Researcher, Academia'
  },
  {
    id: 'bds_002',
    name: 'BDS (Bachelor of Dental Surgery)',
    stream: 'Dental',
    branch: 'UG',
    duration: '60 months',
    duration_years: 5,
    degree_type: 'DENTAL',
    total_seats: 500,
    cutoff_rank: 1500,
    fees: 300000,
    eligibility: 'NEET qualified with Physics, Chemistry, Biology',
    description: 'Undergraduate degree in dental medicine focusing on oral health and dental procedures.',
    college_id: 'mamc_delhi_002',
    college_name: 'Maulana Azad Medical College',
    syllabus: 'Basic sciences, dental materials, oral pathology, surgery, orthodontics',
    career_prospects: 'Dental Surgeon, Orthodontist, Oral Surgeon, Private Practice'
  },
  {
    id: 'md_003',
    name: 'MD (Doctor of Medicine)',
    stream: 'Medical',
    branch: 'PG',
    duration: '36 months',
    duration_years: 3,
    degree_type: 'MEDICAL',
    total_seats: 200,
    cutoff_rank: 100,
    fees: 200000,
    eligibility: 'MBBS degree with NEET PG qualification',
    description: 'Postgraduate degree in various medical specialties including Internal Medicine, Pediatrics, etc.',
    college_id: 'aiims_delhi_001',
    college_name: 'All India Institute of Medical Sciences, New Delhi',
    syllabus: 'Advanced clinical training, research methodology, specialty-specific curriculum',
    career_prospects: 'Specialist Doctor, Consultant, Professor, Researcher'
  }
];

const sampleCutoffs: Partial<Cutoff>[] = [
  {
    id: 'cutoff_001',
    college_id: 'aiims_delhi_001',
    college_name: 'All India Institute of Medical Sciences, New Delhi',
    course_id: 'mbbs_001',
    course_name: 'MBBS',
    year: 2024,
    category: 'General',
    opening_rank: 1,
    closing_rank: 63,
    round: 1,
    state: 'Delhi',
    quota: 'All India Quota',
    seat_type: 'General'
  },
  {
    id: 'cutoff_002',
    college_id: 'aiims_delhi_001',
    college_name: 'All India Institute of Medical Sciences, New Delhi',
    course_id: 'mbbs_001',
    course_name: 'MBBS',
    year: 2024,
    category: 'OBC',
    opening_rank: 64,
    closing_rank: 180,
    round: 1,
    state: 'Delhi',
    quota: 'All India Quota',
    seat_type: 'OBC'
  },
  {
    id: 'cutoff_003',
    college_id: 'mamc_delhi_002',
    college_name: 'Maulana Azad Medical College',
    course_id: 'mbbs_001',
    course_name: 'MBBS',
    year: 2024,
    category: 'General',
    opening_rank: 85,
    closing_rank: 425,
    round: 1,
    state: 'Delhi',
    quota: 'State Quota',
    seat_type: 'General'
  },
  {
    id: 'cutoff_004',
    college_id: 'kmc_manipal_004',
    college_name: 'Kasturba Medical College, Manipal',
    course_id: 'mbbs_001',
    course_name: 'MBBS',
    year: 2024,
    category: 'General',
    opening_rank: 200,
    closing_rank: 8500,
    round: 1,
    state: 'Karnataka',
    quota: 'Management Quota',
    seat_type: 'General'
  },
  {
    id: 'cutoff_005',
    college_id: 'cmc_vellore_005',
    college_name: 'Christian Medical College, Vellore',
    course_id: 'mbbs_001',
    course_name: 'MBBS',
    year: 2024,
    category: 'General',
    opening_rank: 50,
    closing_rank: 650,
    round: 1,
    state: 'Tamil Nadu',
    quota: 'All India Quota',
    seat_type: 'General'
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Seed colleges
    console.log('📚 Seeding colleges...');
    for (const college of sampleColleges) {
      const result = await env.D1.prepare(`
        INSERT OR REPLACE INTO colleges (
          id, name, city, state, management_type, established_year, 
          website, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        college.id,
        college.name,
        college.city,
        college.state,
        college.management_type,
        college.established_year,
        college.website,
        college.description
      ).run();
      
      if (result.success) {
        console.log(`  ✅ Added: ${college.name}`);
      } else {
        console.log(`  ❌ Failed: ${college.name}`);
      }
    }
    
    // Seed courses
    console.log('🎓 Seeding courses...');
    for (const course of sampleCourses) {
      const result = await env.D1.prepare(`
        INSERT OR REPLACE INTO courses (
          id, name, stream, branch, duration_years, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        course.id,
        course.name,
        course.stream,
        course.branch,
        course.duration_years,
        course.description
      ).run();
      
      if (result.success) {
        console.log(`  ✅ Added: ${course.name}`);
        
        // Add college-course relationship
        if (course.college_id) {
          await env.D1.prepare(`
            INSERT OR REPLACE INTO college_courses (
              id, college_id, course_id, total_seats
            ) VALUES (?, ?, ?, ?)
          `).bind(
            `${course.college_id}_${course.id}`,
            course.college_id,
            course.id,
            course.total_seats || 100
          ).run();
        }
      } else {
        console.log(`  ❌ Failed: ${course.name}`);
      }
    }
    
    // Seed cutoffs
    console.log('📊 Seeding cutoffs...');
    for (const cutoff of sampleCutoffs) {
      const result = await env.D1.prepare(`
        INSERT OR REPLACE INTO cutoffs (
          id, college_id, course_id, year, category, opening_rank, 
          closing_rank, round, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        cutoff.id,
        cutoff.college_id,
        cutoff.course_id,
        cutoff.year,
        cutoff.category,
        cutoff.opening_rank,
        cutoff.closing_rank,
        cutoff.round
      ).run();
      
      if (result.success) {
        console.log(`  ✅ Added cutoff: ${cutoff.college_name} - ${cutoff.category}`);
      } else {
        console.log(`  ❌ Failed cutoff: ${cutoff.college_name} - ${cutoff.category}`);
      }
    }
    
    // Add some sample vector data for search
    console.log('🔍 Seeding vector data...');
    const vectors = sampleColleges.map(college => ({
      id: college.id!,
      values: Array.from({length: 768}, () => Math.random()), // Mock embeddings
      metadata: {
        type: 'college',
        id: college.id,
        name: college.name,
        city: college.city,
        state: college.state,
        description: college.description
      }
    }));
    
    await env.VECTORIZE.insert(vectors);
    console.log(`  ✅ Added ${vectors.length} vector embeddings`);
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  - Colleges: ${sampleColleges.length}`);
    console.log(`  - Courses: ${sampleCourses.length}`);
    console.log(`  - Cutoffs: ${sampleCutoffs.length}`);
    console.log(`  - Vector embeddings: ${vectors.length}`);
    console.log('');
    console.log('🧪 Test your API:');
    console.log('  - curl http://localhost:3501/api/colleges');
    console.log('  - curl http://localhost:3501/api/courses');
    console.log('  - curl "http://localhost:3501/api/search?q=AIIMS"');
    console.log('  - curl http://localhost:3501/api/cutoffs');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

export { seedDatabase, sampleColleges, sampleCourses, sampleCutoffs };