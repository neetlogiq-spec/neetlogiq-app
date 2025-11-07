#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

interface FoundationCollege {
    name: string;
    state: string;
    address: string;
    previous_name?: string;
}

function checkFoundationData() {
    console.log('🔍 CHECKING FOUNDATION DATA FOR SPECIFIC COLLEGES');
    console.log('=============================================');

    // Load foundation data
    const dataPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
    const colleges: FoundationCollege[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log(`\n📊 Total foundation colleges: ${colleges.length}`);

    // Check for PGIMER in New Delhi
    console.log('\n🔍 Searching for PGIMER in New Delhi:');
    const pgimer = colleges.filter(c => 
        (c.name.includes('POST GRADUATE INSTITUTE') || c.name.includes('PGIMER')) &&
        c.state === 'NEW DELHI'
    );
    console.log('Found matches:');
    pgimer.forEach(c => console.log(`- ${c.name} (${c.state})`));

    // Check for Seth GS Medical College in Maharashtra
    console.log('\n🔍 Searching for Seth GS Medical College in Maharashtra:');
    const sethGs = colleges.filter(c => 
        (c.name.includes('SETH') || c.name.includes('G.S.') || c.name.includes('GORDHANDAS')) &&
        c.state === 'MAHARASHTRA'
    );
    console.log('Found matches:');
    sethGs.forEach(c => console.log(`- ${c.name} (${c.state})`));

    // Check all colleges in New Delhi
    console.log('\n📋 All colleges in New Delhi:');
    const delhiColleges = colleges.filter(c => c.state === 'NEW DELHI');
    console.log(`Found ${delhiColleges.length} colleges:`);
    delhiColleges.forEach(c => console.log(`- ${c.name}`));

    // Check all colleges in Maharashtra
    console.log('\n📋 All colleges in Maharashtra:');
    const maharashtraColleges = colleges.filter(c => c.state === 'MAHARASHTRA');
    console.log(`Found ${maharashtraColleges.length} colleges:`);
    maharashtraColleges.forEach(c => console.log(`- ${c.name}`));
}

if (require.main === module) {
    checkFoundationData();
}
