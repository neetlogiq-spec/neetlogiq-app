import Database from 'better-sqlite3';
import path from 'path';

async function addManualMatches() {
  const stagingDbPath = path.join(process.cwd(), 'data/staging/staging.db');
  const db = new Database(stagingDbPath);

  try {
    console.log('🔧 Adding manual matches...');

    // Add SK Hospital match
    const skHospitalMatch = db.prepare(`
      INSERT INTO staging_college_matches 
      (id, staging_college_name, unified_college_id, unified_college_name, match_confidence, match_method, distance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    skHospitalMatch.run(
      'sk_hospital_manual_match',
      'SKHOSPITAL,SUPERINTENDENT RNO 36 GOVT SK HOSPITAL SILVER JUBLI ROAD SIKAR RAJ, RAJASTHAN, 332001',
      'dnb_901777',
      'SK HOSPITAL',
      1.0,
      'manual',
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    console.log('✅ Added SK Hospital match');

    // Add DR B BOROOAH CANCER INSTITUTE matches (the 2 unmatched variations)
    const drBorooahMatch = db.prepare(`
      INSERT INTO staging_college_matches 
      (id, staging_college_name, unified_college_id, unified_college_name, match_confidence, match_method, distance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Match 1: DRBBOROOAH CANCER INSTITUTE , DRBBOROOAH CANCER INSTITUTE, ASSAM, 781016
    drBorooahMatch.run(
      'dr_borooah_manual_match_1',
      'DRBBOROOAH CANCER INSTITUTE , DRBBOROOAH CANCER INSTITUTE, ASSAM, 781016',
      'medical_dr-b-borooah-cancer-institute-regional-cancer-centre_guwahati',
      'DR B BOROOAH CANCER INSTITUTE (REGIONAL CANCER CENTRE)',
      1.0,
      'manual',
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Match 2: DRBBOROOAH CANCER INSTITUTE,DRBBOROOAH CANCER INSTITUTE, ASSAM, 781016
    drBorooahMatch.run(
      'dr_borooah_manual_match_2',
      'DRBBOROOAH CANCER INSTITUTE,DRBBOROOAH CANCER INSTITUTE, ASSAM, 781016',
      'medical_dr-b-borooah-cancer-institute-regional-cancer-centre_guwahati',
      'DR B BOROOAH CANCER INSTITUTE (REGIONAL CANCER CENTRE)',
      1.0,
      'manual',
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );

    console.log('✅ Added DR B BOROOAH CANCER INSTITUTE matches');

    // Check final status
    const totalCollegesResult = db.prepare('SELECT COUNT(DISTINCT college_institute) as count FROM staging_counselling_records').get() as { count: number };
    const matchedCollegesResult = db.prepare('SELECT COUNT(*) as count FROM staging_college_matches WHERE unified_college_id IS NOT NULL').get() as { count: number };
    const totalColleges = totalCollegesResult.count;
    const matchedColleges = matchedCollegesResult.count;
    const unmatchedColleges = totalColleges - matchedColleges;

    console.log('\n📊 Final Matching Status:');
    console.log(`Total Colleges: ${totalColleges}`);
    console.log(`Matched Colleges: ${matchedColleges}`);
    console.log(`Unmatched Colleges: ${unmatchedColleges}`);
    console.log(`Match Rate: ${((matchedColleges / totalColleges) * 100).toFixed(1)}%`);

    if (unmatchedColleges > 0) {
      console.log('\n❌ Remaining Unmatched Colleges:');
      const unmatched = db.prepare(`
        SELECT DISTINCT college_institute 
        FROM staging_counselling_records 
        WHERE college_institute NOT IN (SELECT staging_college_name FROM staging_college_matches)
      `).all() as { college_institute: string }[];
      
      unmatched.forEach((college, index) => {
        console.log(`${index + 1}. ${college.college_institute}`);
      });
    }

  } catch (error) {
    console.error('❌ Error adding manual matches:', error);
  } finally {
    db.close();
  }
}

addManualMatches();
