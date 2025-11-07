#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

interface FoundationCollege {
    name: string;
    state: string;
    address: string;
    previous_name?: string;
}

function checkSethGS() {
    console.log('🔍 CHECKING SETH GS MEDICAL COLLEGE DATA');
    console.log('=====================================');

    // Load foundation data
    const dataPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
    const colleges: FoundationCollege[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log(`\n📊 Total foundation colleges: ${colleges.length}`);

    // Search for any college with "SETH" in the name
    console.log('\n🔍 Searching for colleges with "SETH" in the name:');
    const sethColleges = colleges.filter(c => 
        c.name.includes('SETH') || 
        (c.previous_name && c.previous_name.includes('SETH'))
    );

    console.log('Found matches:');
    sethColleges.forEach(c => {
        console.log(`\n- Name: "${c.name}"`);
        console.log(`  State: ${c.state}`);
        console.log(`  Address: ${c.address}`);
        if (c.previous_name) {
            console.log(`  Previous Name: ${c.previous_name}`);
        }
    });

    // Search for any college with "G.S." or "GS" in the name
    console.log('\n🔍 Searching for colleges with "G.S." or "GS" in the name:');
    const gsColleges = colleges.filter(c => 
        c.name.includes('G.S.') || 
        c.name.includes('GS ') || 
        (c.previous_name && (c.previous_name.includes('G.S.') || c.previous_name.includes('GS ')))
    );

    console.log('Found matches:');
    gsColleges.forEach(c => {
        console.log(`\n- Name: "${c.name}"`);
        console.log(`  State: ${c.state}`);
        console.log(`  Address: ${c.address}`);
        if (c.previous_name) {
            console.log(`  Previous Name: ${c.previous_name}`);
        }
    });

    // Search for any college with "GORDHANDAS" or "SUNDERDAS" in the name
    console.log('\n🔍 Searching for colleges with "GORDHANDAS" or "SUNDERDAS" in the name:');
    const gsNameColleges = colleges.filter(c => 
        c.name.includes('GORDHANDAS') || 
        c.name.includes('SUNDERDAS') || 
        (c.previous_name && (c.previous_name.includes('GORDHANDAS') || c.previous_name.includes('SUNDERDAS')))
    );

    console.log('Found matches:');
    gsNameColleges.forEach(c => {
        console.log(`\n- Name: "${c.name}"`);
        console.log(`  State: ${c.state}`);
        console.log(`  Address: ${c.address}`);
        if (c.previous_name) {
            console.log(`  Previous Name: ${c.previous_name}`);
        }
    });
}

if (require.main === module) {
    checkSethGS();
}
