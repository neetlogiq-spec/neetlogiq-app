#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

interface FoundationCollege {
    name: string;
    state: string;
    address: string;
    previous_name?: string;
}

function checkStateColleges() {
    console.log('🔍 CHECKING COLLEGES IN SPECIFIC STATES');
    console.log('=====================================');

    // Load foundation data
    const dataPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
    const colleges: FoundationCollege[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    const statesToCheck = ['GUJARAT', 'HARYANA', 'ODISHA', 'RAJASTHAN', 'UTTAR PRADESH'];

    for (const state of statesToCheck) {
        console.log(`\n📋 COLLEGES IN ${state}:`);
        console.log('='.repeat(state.length + 12));
        
        const stateColleges = colleges.filter(c => c.state === state);
        console.log(`Found ${stateColleges.length} colleges:\n`);
        
        stateColleges.forEach((c, i) => {
            console.log(`${(i + 1).toString().padStart(3)}. ${c.name}`);
            if (c.previous_name) {
                console.log(`     Previous: ${c.previous_name}`);
            }
        });
    }

    // Check for specific patterns
    console.log('\n🔍 SEARCHING FOR SPECIFIC PATTERNS:');
    console.log('===================================');

    const patterns = [
        { name: 'SBKS', states: ['GUJARAT'] },
        { name: 'MM INSTITUTE', states: ['HARYANA'] },
        { name: 'KALINGA', states: ['ODISHA'] },
        { name: 'RAVINDRA', states: ['RAJASTHAN'] },
        { name: 'M P SHAH', states: ['GUJARAT'] },
        { name: 'SAROJINI', states: ['UTTAR PRADESH'] }
    ];

    for (const pattern of patterns) {
        console.log(`\n🔍 Looking for "${pattern.name}" in ${pattern.states.join(', ')}:`);
        
        for (const state of pattern.states) {
            const matches = colleges.filter(c => 
                c.state === state && 
                (c.name.includes(pattern.name) || (c.previous_name && c.previous_name.includes(pattern.name)))
            );
            
            if (matches.length > 0) {
                console.log(`   ${state}:`);
                matches.forEach(m => {
                    console.log(`   - ${m.name}`);
                    if (m.previous_name) {
                        console.log(`     Previous: ${m.previous_name}`);
                    }
                });
            } else {
                console.log(`   ${state}: No matches found`);
            }
        }
    }
}

if (require.main === module) {
    checkStateColleges();
}
