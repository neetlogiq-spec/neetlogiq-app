#!/usr/bin/env python3
"""
Vector Embeddings Generation Script for Edge-Native + AI Architecture
This script generates vector embeddings for colleges, courses, and cutoffs data
"""

import sqlite3
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import os
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmbeddingGenerator:
    def __init__(self, db_path: str, output_dir: str):
        self.db_path = db_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Initialize sentence transformer model
        logger.info("Loading sentence transformer model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("Model loaded successfully")
    
    def generate_college_embeddings(self):
        """Generate embeddings for colleges"""
        logger.info("Generating college embeddings...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get colleges data
        cursor.execute("""
            SELECT id, name, state, city, type, management, 
                   university_affiliation, website, address, 
                   established_year, recognition, affiliation
            FROM medical_colleges
        """)
        
        colleges = cursor.fetchall()
        logger.info(f"Found {len(colleges)} colleges")
        
        embeddings_data = []
        
        for college in colleges:
            college_id, name, state, city, college_type, management, university_affiliation, website, address, established_year, recognition, affiliation = college
            
            # Create text representation for embedding
            text_parts = [name]
            if state:
                text_parts.append(f"State: {state}")
            if city:
                text_parts.append(f"City: {city}")
            if college_type:
                text_parts.append(f"Type: {college_type}")
            if management:
                text_parts.append(f"Management: {management}")
            if university_affiliation:
                text_parts.append(f"University: {university_affiliation}")
            if recognition:
                text_parts.append(f"Recognition: {recognition}")
            
            text = " | ".join(text_parts)
            
            # Generate embedding
            embedding = self.model.encode(text)
            
            embeddings_data.append({
                'id': college_id,
                'name': name,
                'text': text,
                'embedding': embedding.tolist(),
                'metadata': {
                    'state': state,
                    'city': city,
                    'type': college_type,
                    'management': management
                }
            })
        
        # Save embeddings
        output_file = self.output_dir / 'college_embeddings.json'
        with open(output_file, 'w') as f:
            json.dump(embeddings_data, f, indent=2)
        
        logger.info(f"College embeddings saved to {output_file}")
        conn.close()
        return len(embeddings_data)
    
    def generate_course_embeddings(self):
        """Generate embeddings for courses"""
        logger.info("Generating course embeddings...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get courses data
        cursor.execute("""
            SELECT id, name, code, stream, branch, degree_type, 
                   duration_years, syllabus, career_prospects
            FROM courses
        """)
        
        courses = cursor.fetchall()
        logger.info(f"Found {len(courses)} courses")
        
        embeddings_data = []
        
        for course in courses:
            course_id, name, code, stream, branch, degree_type, duration_years, syllabus, career_prospects = course
            
            # Create text representation for embedding
            text_parts = [name]
            if code:
                text_parts.append(f"Code: {code}")
            if stream:
                text_parts.append(f"Stream: {stream}")
            if branch:
                text_parts.append(f"Branch: {branch}")
            if degree_type:
                text_parts.append(f"Degree: {degree_type}")
            if duration_years:
                text_parts.append(f"Duration: {duration_years} years")
            if syllabus:
                text_parts.append(f"Syllabus: {syllabus}")
            if career_prospects:
                text_parts.append(f"Career: {career_prospects}")
            
            text = " | ".join(text_parts)
            
            # Generate embedding
            embedding = self.model.encode(text)
            
            embeddings_data.append({
                'id': course_id,
                'name': name,
                'text': text,
                'embedding': embedding.tolist(),
                'metadata': {
                    'code': code,
                    'stream': stream,
                    'branch': branch,
                    'degree_type': degree_type
                }
            })
        
        # Save embeddings
        output_file = self.output_dir / 'course_embeddings.json'
        with open(output_file, 'w') as f:
            json.dump(embeddings_data, f, indent=2)
        
        logger.info(f"Course embeddings saved to {output_file}")
        conn.close()
        return len(embeddings_data)
    
    def generate_cutoff_embeddings(self):
        """Generate embeddings for cutoff records"""
        logger.info("Generating cutoff embeddings...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get cutoff data
        cursor.execute("""
            SELECT id, college_institute_normalized, course_normalized, 
                   state_normalized, category, quota, year, round_normalized,
                   all_india_rank, source_normalized, level_normalized
            FROM counselling_records
            WHERE college_institute_normalized IS NOT NULL 
            AND course_normalized IS NOT NULL
            LIMIT 10000
        """)
        
        cutoffs = cursor.fetchall()
        logger.info(f"Found {len(cutoffs)} cutoff records")
        
        embeddings_data = []
        
        for cutoff in cutoffs:
            cutoff_id, college, course, state, category, quota, year, round_num, rank, source, level = cutoff
            
            # Create text representation for embedding
            text_parts = [f"College: {college}"]
            if course:
                text_parts.append(f"Course: {course}")
            if state:
                text_parts.append(f"State: {state}")
            if category:
                text_parts.append(f"Category: {category}")
            if quota:
                text_parts.append(f"Quota: {quota}")
            if year:
                text_parts.append(f"Year: {year}")
            if round_num:
                text_parts.append(f"Round: {round_num}")
            if rank:
                text_parts.append(f"Rank: {rank}")
            if source:
                text_parts.append(f"Source: {source}")
            if level:
                text_parts.append(f"Level: {level}")
            
            text = " | ".join(text_parts)
            
            # Generate embedding
            embedding = self.model.encode(text)
            
            embeddings_data.append({
                'id': cutoff_id,
                'college': college,
                'course': course,
                'text': text,
                'embedding': embedding.tolist(),
                'metadata': {
                    'state': state,
                    'category': category,
                    'quota': quota,
                    'year': year,
                    'round': round_num,
                    'rank': rank,
                    'source': source,
                    'level': level
                }
            })
        
        # Save embeddings
        output_file = self.output_dir / 'cutoff_embeddings.json'
        with open(output_file, 'w') as f:
            json.dump(embeddings_data, f, indent=2)
        
        logger.info(f"Cutoff embeddings saved to {output_file}")
        conn.close()
        return len(embeddings_data)
    
    def generate_all_embeddings(self):
        """Generate all embeddings"""
        logger.info("Starting embedding generation...")
        
        total_colleges = self.generate_college_embeddings()
        total_courses = self.generate_course_embeddings()
        total_cutoffs = self.generate_cutoff_embeddings()
        
        logger.info(f"Embedding generation complete!")
        logger.info(f"Generated {total_colleges} college embeddings")
        logger.info(f"Generated {total_courses} course embeddings")
        logger.info(f"Generated {total_cutoffs} cutoff embeddings")
        
        return {
            'colleges': total_colleges,
            'courses': total_courses,
            'cutoffs': total_cutoffs
        }

def main():
    # Database paths
    master_db = "/Users/kashyapanand/Public/New/data/sqlite/master_data.db"
    counselling_db = "/Users/kashyapanand/Public/New/data/sqlite/counselling_data_partitioned.db"
    
    # Output directory
    output_dir = "/Users/kashyapanand/Public/New/data/embeddings"
    
    # Generate college and course embeddings from master database
    logger.info("Generating embeddings from master database...")
    master_generator = EmbeddingGenerator(master_db, output_dir)
    master_results = master_generator.generate_all_embeddings()
    
    # Generate cutoff embeddings from counselling database
    logger.info("Generating embeddings from counselling database...")
    cutoff_generator = EmbeddingGenerator(counselling_db, output_dir)
    cutoff_results = cutoff_generator.generate_cutoff_embeddings()
    
    # Summary
    logger.info("=== EMBEDDING GENERATION SUMMARY ===")
    logger.info(f"Colleges: {master_results['colleges']}")
    logger.info(f"Courses: {master_results['courses']}")
    logger.info(f"Cutoffs: {cutoff_results}")
    logger.info(f"Output directory: {output_dir}")

if __name__ == "__main__":
    main()
