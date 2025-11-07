#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Fuse from 'fuse.js';

interface UnmatchedCollege {
    college: string;
    state: string;
    full_name: string;
    record_count: number;
}

interface FoundationCollege {
    id?: string;
    name: string;
    state: string;
    address: string;
    previous_name?: string;
}

interface ManualMapping {
    unmatched_name: string;
    unmatched_state: string;
    mapped_to_id: string;
    confidence: 'MANUAL';
}

class InteractiveCollegeMapper {
    private unmatchedColleges: UnmatchedCollege[] = [];
    private foundationColleges: FoundationCollege[] = [];
    private manualMappings: Record<string, ManualMapping> = {};
    private newlyAddedColleges: FoundationCollege[] = [];
    private fuse!: Fuse<FoundationCollege>;
    private rl: readline.Interface;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    private async askQuestion(query: string): Promise<string> {
        return new Promise(resolve => this.rl.question(query, resolve));
    }

    private loadData(): void {
        console.log('🔄 Loading data...');
        
        // Load unmatched colleges
        const unmatchedPath = path.join(process.cwd(), 'data', 'COMPLETE_UNMATCHED_COLLEGES.json');
        this.unmatchedColleges = JSON.parse(fs.readFileSync(unmatchedPath, 'utf-8'));

        // Load foundation colleges
        const foundationPath = path.join(process.cwd(), 'data', 'updated-foundation-colleges.json');
        this.foundationColleges = JSON.parse(fs.readFileSync(foundationPath, 'utf-8'))
            .map((c: FoundationCollege, i: number) => ({
                ...c,
                id: `${c.name}|${c.state}|${i}`
            }));

        // Load existing manual mappings if any
        const mappingsPath = path.join(process.cwd(), 'data', 'manual-mappings.json');
        if (fs.existsSync(mappingsPath)) {
            const existingMappings: ManualMapping[] = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));
            existingMappings.forEach(m => {
                const key = `${m.unmatched_name}|${m.unmatched_state}`;
                this.manualMappings[key] = m;
            });
        }

        // Load newly added colleges if any
        const newCollegesPath = path.join(process.cwd(), 'data', 'newly-added-colleges.json');
        if (fs.existsSync(newCollegesPath)) {
            this.newlyAddedColleges = JSON.parse(fs.readFileSync(newCollegesPath, 'utf-8'));
        }

        console.log(`✅ Loaded ${this.unmatchedColleges.length} unmatched colleges.`);
        console.log(`✅ Loaded ${this.foundationColleges.length} foundation colleges.`);
        console.log(`✅ Loaded ${Object.keys(this.manualMappings).length} existing manual mappings.`);
        console.log(`✅ Loaded ${this.newlyAddedColleges.length} newly added colleges.`);
    }

    private initializeFuzzySearch(): void {
        console.log('🔍 Initializing fuzzy search engine...');
        this.fuse = new Fuse(this.foundationColleges, {
            keys: ['name', 'previous_name', 'address'],
            includeScore: true,
            threshold: 0.6,
            minMatchCharLength: 5
        });
    }

    private saveProgress(log: boolean = true): void {
        // Save manual mappings
        const mappingsPath = path.join(process.cwd(), 'data', 'manual-mappings.json');
        fs.writeFileSync(mappingsPath, JSON.stringify(Object.values(this.manualMappings), null, 2));

        // Save newly added colleges
        const newCollegesPath = path.join(process.cwd(), 'data', 'newly-added-colleges.json');
        fs.writeFileSync(newCollegesPath, JSON.stringify(this.newlyAddedColleges, null, 2));

        if (log) {
            console.log(`\n💾 Progress saved!`);
            console.log(`   - ${Object.keys(this.manualMappings).length} mappings saved to ${path.basename(mappingsPath)}`);
            console.log(`   - ${this.newlyAddedColleges.length} new colleges saved to ${path.basename(newCollegesPath)}`);
        }
    }

    public async run(): Promise<void> {
        console.clear();
        console.log('🚀 Welcome to the Interactive College Mapper! 🚀');
        console.log('--------------------------------------------------');

        this.loadData();
        this.initializeFuzzySearch();

        // Filter out already mapped colleges
        const collegesToMap = this.unmatchedColleges.filter(u => {
            const key = `${u.college}|${u.state}`;
            return !this.manualMappings[key];
        });

        console.log(`\n🔥 ${collegesToMap.length} colleges remaining to be mapped.`);

        let counter = 0;
        for (const unmatched of collegesToMap) {
            counter++;
            const key = `${unmatched.college}|${unmatched.state}`;
            
            console.clear();
            console.log(`\nMapping college ${counter} of ${collegesToMap.length} (Total unmatched: ${this.unmatchedColleges.length})`);
            console.log('--------------------------------------------------');
            console.log(`\x1b[1m\x1b[31mUNMATCHED:\x1b[0m ${unmatched.college}`);
            console.log(`\x1b[1m\x1b[31mSTATE:\x1b[0m     ${unmatched.state}`);
            console.log(`\x1b[1m\x1b[31mRECORDS:\x1b[0m   ${unmatched.record_count}`);
            console.log('--------------------------------------------------');

            // Get fuzzy search suggestions
            const results = this.fuse.search(unmatched.college)
                .filter(r => r.item.state === unmatched.state)
                .slice(0, 5);

            console.log('Did you mean?');
            results.forEach((result, index) => {
                console.log(`  \x1b[32m[${index + 1}]\x1b[0m ${result.item.name} (\x1b[90m${result.item.state}\x1b[0m)`);
            });

            console.log('\n  \x1b[33m[A]\x1b[0m Add as a new, distinct college.');
            console.log('  \x1b[33m[S]\x1b[0m Skip this college for now.');
            console.log('  \x1b[33m[Q]\x1b[0m Quit and save progress.');

            const choice = await this.askQuestion('\nYour choice: ');

            const upperChoice = choice.toUpperCase();

            if (upperChoice === 'Q') {
                this.saveProgress();
                console.log('👋 Progress saved. Goodbye!');
                break;
            } else if (upperChoice === 'S') {
                console.log('⏭️  Skipping for now.');
                continue; // Don't save a mapping, just move to the next one
            } else if (upperChoice === 'A') {
                const newCollege: FoundationCollege = {
                    id: `NEW|${unmatched.college}|${unmatched.state}`,
                    name: unmatched.college,
                    state: unmatched.state,
                    address: `(Address for: ${unmatched.full_name})` // Placeholder address
                };
                this.newlyAddedColleges.push(newCollege);
                this.manualMappings[key] = {
                    unmatched_name: unmatched.college,
                    unmatched_state: unmatched.state,
                    mapped_to_id: newCollege.id || '',
                    confidence: 'MANUAL'
                };
                console.log(`✨ Added "${unmatched.college}" as a new college.`);
            } else {
                const choiceIndex = parseInt(choice, 10) - 1;
                if (choiceIndex >= 0 && choiceIndex < results.length) {
                    const selectedCollege = results[choiceIndex].item;
                    this.manualMappings[key] = {
                        unmatched_name: unmatched.college,
                        unmatched_state: unmatched.state,
                        mapped_to_id: selectedCollege.id || '',
                        confidence: 'MANUAL'
                    };
                    console.log(`✅ Mapped to: ${selectedCollege.name}`);
                } else {
                    console.log('⚠️ Invalid choice. Skipping this college.');
                }
            }

            // Autosave after each decision
            this.saveProgress(false);
        }

        this.rl.close();
        if (counter === collegesToMap.length) {
            console.log('\n🎉 All colleges have been mapped! 🎉');
            this.saveProgress();
        }
    }
}

if (require.main === module) {
    const mapper = new InteractiveCollegeMapper();
    mapper.run().catch(console.error);
}