#!/usr/bin/env node
/**
 * Fixed Vector Embeddings Generation Script
 * This script generates mock embeddings for demonstration purposes
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class SimpleEmbeddingGenerator {
    constructor(dbPath, outputDir) {
        this.dbPath = dbPath;
        this.outputDir = outputDir;
        
        // Create output directory
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }

    // Simple hash-based embedding generation (for demo purposes)
    generateSimpleEmbedding(text) {
        const hash = this.simpleHash(text);
        const embedding = new Array(384).fill(0);
        
        // Generate pseudo-random embedding based on text hash
        for (let i = 0; i < 384; i++) {
            embedding[i] = Math.sin(hash + i) * 0.5;
        }
        
        return embedding;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    async generateCollegeEmbeddings() {
        console.log('Generating college embeddings...');
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            db.all(`
                SELECT id, name, state, address, college_type, normalized_name, normalized_state
                FROM medical_colleges
            `, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log(`Found ${rows.length} colleges`);
                
                const embeddings = rows.map(college => {
                    const text = [
                        college.name,
                        college.state,
                        college.address,
                        college.college_type,
                        college.normalized_name,
                        college.normalized_state
                    ].filter(Boolean).join(' | ');
                    
                    return {
                        id: college.id,
                        name: college.name,
                        text: text,
                        embedding: this.generateSimpleEmbedding(text),
                        metadata: {
                            state: college.state,
                            address: college.address,
                            type: college.college_type,
                            normalized_name: college.normalized_name,
                            normalized_state: college.normalized_state
                        }
                    };
                });

                // Save embeddings
                const outputFile = path.join(this.outputDir, 'college_embeddings.json');
                fs.writeFileSync(outputFile, JSON.stringify(embeddings, null, 2));
                
                console.log(`College embeddings saved to ${outputFile}`);
                db.close();
                resolve(embeddings.length);
            });
        });
    }

    async generateCourseEmbeddings() {
        console.log('Generating course embeddings...');
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            db.all(`
                SELECT id, name, code, stream, branch, degree_type, 
                       duration_years, syllabus, career_prospects
                FROM courses
            `, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log(`Found ${rows.length} courses`);
                
                const embeddings = rows.map(course => {
                    const text = [
                        course.name,
                        course.code,
                        course.stream,
                        course.branch,
                        course.degree_type,
                        course.syllabus,
                        course.career_prospects
                    ].filter(Boolean).join(' | ');
                    
                    return {
                        id: course.id,
                        name: course.name,
                        text: text,
                        embedding: this.generateSimpleEmbedding(text),
                        metadata: {
                            code: course.code,
                            stream: course.stream,
                            branch: course.branch,
                            degree_type: course.degree_type
                        }
                    };
                });

                // Save embeddings
                const outputFile = path.join(this.outputDir, 'course_embeddings.json');
                fs.writeFileSync(outputFile, JSON.stringify(embeddings, null, 2));
                
                console.log(`Course embeddings saved to ${outputFile}`);
                db.close();
                resolve(embeddings.length);
            });
        });
    }

    async generateCutoffEmbeddings() {
        console.log('Generating cutoff embeddings...');
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);
            
            db.all(`
                SELECT id, college_institute_normalized, course_normalized, 
                       state_normalized, category, quota, year, round_normalized,
                       all_india_rank, source_normalized, level_normalized
                FROM counselling_records
                WHERE college_institute_normalized IS NOT NULL 
                AND course_normalized IS NOT NULL
                LIMIT 1000
            `, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log(`Found ${rows.length} cutoff records`);
                
                const embeddings = rows.map(cutoff => {
                    const text = [
                        `College: ${cutoff.college_institute_normalized}`,
                        `Course: ${cutoff.course_normalized}`,
                        `State: ${cutoff.state_normalized}`,
                        `Category: ${cutoff.category}`,
                        `Quota: ${cutoff.quota}`,
                        `Year: ${cutoff.year}`,
                        `Round: ${cutoff.round_normalized}`,
                        `Rank: ${cutoff.all_india_rank}`,
                        `Source: ${cutoff.source_normalized}`,
                        `Level: ${cutoff.level_normalized}`
                    ].filter(Boolean).join(' | ');
                    
                    return {
                        id: cutoff.id,
                        college: cutoff.college_institute_normalized,
                        course: cutoff.course_normalized,
                        text: text,
                        embedding: this.generateSimpleEmbedding(text),
                        metadata: {
                            state: cutoff.state_normalized,
                            category: cutoff.category,
                            quota: cutoff.quota,
                            year: cutoff.year,
                            round: cutoff.round_normalized,
                            rank: cutoff.all_india_rank,
                            source: cutoff.source_normalized,
                            level: cutoff.level_normalized
                        }
                    };
                });

                // Save embeddings
                const outputFile = path.join(this.outputDir, 'cutoff_embeddings.json');
                fs.writeFileSync(outputFile, JSON.stringify(embeddings, null, 2));
                
                console.log(`Cutoff embeddings saved to ${outputFile}`);
                db.close();
                resolve(embeddings.length);
            });
        });
    }

    async generateAllEmbeddings() {
        console.log('Starting embedding generation...');
        
        try {
            // Generate college and course embeddings from master database
            const masterDb = '/Users/kashyapanand/Public/New/data/sqlite/master_data.db';
            const masterGenerator = new SimpleEmbeddingGenerator(masterDb, this.outputDir);
            
            const collegeCount = await masterGenerator.generateCollegeEmbeddings();
            const courseCount = await masterGenerator.generateCourseEmbeddings();
            
            // Generate cutoff embeddings from counselling database
            const counsellingDb = '/Users/kashyapanand/Public/New/data/sqlite/counselling_data_partitioned.db';
            const cutoffGenerator = new SimpleEmbeddingGenerator(counsellingDb, this.outputDir);
            
            const cutoffCount = await cutoffGenerator.generateCutoffEmbeddings();
            
            console.log('=== EMBEDDING GENERATION SUMMARY ===');
            console.log(`Colleges: ${collegeCount}`);
            console.log(`Courses: ${courseCount}`);
            console.log(`Cutoffs: ${cutoffCount}`);
            console.log(`Output directory: ${this.outputDir}`);
            
        } catch (error) {
            console.error('Error generating embeddings:', error);
        }
    }
}

// Run the embedding generation
const outputDir = '/Users/kashyapanand/Public/New/data/embeddings';
const generator = new SimpleEmbeddingGenerator('', outputDir);
generator.generateAllEmbeddings();
