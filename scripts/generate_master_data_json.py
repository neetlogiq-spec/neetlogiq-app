#!/usr/bin/env python3
"""
Generate Master Data JSON Files
Creates clean master data files with display names and linking IDs

Usage:
    python3 scripts/generate_master_data_json.py
"""

import sqlite3
import json
import asyncio
import aiofiles
from pathlib import Path
from typing import Dict, List, Any
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MasterDataGenerator:
    def __init__(self):
        self.output_dir = Path('output/r2-data')
        self.master_dir = self.output_dir / 'master'
        self.data_dir = self.output_dir / 'data'
        self.search_dir = self.output_dir / 'search'
        
        # Create directories
        self.master_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / 'colleges').mkdir(parents=True, exist_ok=True)
        (self.data_dir / 'courses').mkdir(parents=True, exist_ok=True)
        (self.data_dir / 'cutoffs').mkdir(parents=True, exist_ok=True)
        self.search_dir.mkdir(parents=True, exist_ok=True)
        
        self.stats = {
            'colleges_processed': 0,
            'courses_processed': 0,
            'cutoffs_processed': 0,
            'start_time': datetime.now()
        }
    
    async def generate_master_colleges(self) -> List[Dict]:
        """Generate master colleges data with clean display names"""
        logger.info("🔄 Generating master colleges data...")
        
        conn = sqlite3.connect('data/sqlite/master_data.db')
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, city, state, management_type, established_year, website, description
            FROM colleges 
            ORDER BY name
        """)
        
        colleges = []
        for row in cursor.fetchall():
            college = {
                "id": row[0],
                "display_name": row[1],  # Clean master name
                "city": row[2],
                "state": row[3],
                "management_type": row[4],
                "established_year": row[5],
                "website": row[6],
                "description": row[7] or ""
            }
            colleges.append(college)
        
        conn.close()
        
        # Write master colleges file
        async with aiofiles.open(self.master_dir / 'colleges.json', 'w') as f:
            await f.write(json.dumps(colleges, indent=2, ensure_ascii=False))
        
        logger.info(f"✅ Generated master colleges: {len(colleges)} colleges")
        return colleges
    
    async def generate_master_courses(self) -> List[Dict]:
        """Generate master courses data with clean display names"""
        logger.info("🔄 Generating master courses data...")
        
        conn = sqlite3.connect('data/sqlite/master_data.db')
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, stream, branch, duration_years, description
            FROM courses 
            ORDER BY stream, name
        """)
        
        courses = []
        for row in cursor.fetchall():
            course = {
                "id": row[0],
                "display_name": row[1],  # Clean master name
                "stream": row[2],
                "branch": row[3],
                "duration_years": row[4],
                "description": row[5] or ""
            }
            courses.append(course)
        
        conn.close()
        
        # Write master courses file
        async with aiofiles.open(self.master_dir / 'courses.json', 'w') as f:
            await f.write(json.dumps(courses, indent=2, ensure_ascii=False))
        
        logger.info(f"✅ Generated master courses: {len(courses)} courses")
        return courses
    
    async def generate_college_data_by_id(self, college_id: str) -> Dict:
        """Generate complete data for a single college by ID"""
        try:
            # Fetch seats data
            seats_data = await self.fetch_seats_data(college_id)
            
            # Fetch cutoffs data
            cutoffs_data = await self.fetch_cutoffs_data(college_id)
            
            # Calculate statistics
            statistics = self.calculate_college_statistics(seats_data, cutoffs_data)
            
            college_data = {
                "id": college_id,
                "seats": seats_data,
                "cutoffs": cutoffs_data,
                "statistics": statistics,
                "last_updated": datetime.now().isoformat()
            }
            
            return college_data
            
        except Exception as e:
            logger.error(f"❌ Error generating data for college {college_id}: {e}")
            return {"id": college_id, "error": str(e)}
    
    async def fetch_seats_data(self, college_id: str) -> Dict:
        """Fetch seats data from seat_data.db"""
        conn = sqlite3.connect('data/sqlite/seat_data.db')
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT course_id, year, total_seats, general_seats, obc_seats, sc_seats, st_seats
            FROM seat_availability 
            WHERE college_id = ?
            ORDER BY year DESC, course_id
        """, (college_id,))
        
        seats = {}
        for row in cursor.fetchall():
            course_id, year, total, general, obc, sc, st = row
            if year not in seats:
                seats[year] = {}
            seats[year][course_id] = {
                "total": total or 0,
                "general": general or 0,
                "obc": obc or 0,
                "sc": sc or 0,
                "st": st or 0
            }
        
        conn.close()
        return seats
    
    async def fetch_cutoffs_data(self, college_id: str) -> Dict:
        """Fetch cutoffs data from counselling_data_partitioned.db"""
        conn = sqlite3.connect('data/sqlite/counselling_data_partitioned.db')
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT course_id, year, round, category, cutoff_rank
            FROM counselling_records 
            WHERE college_id = ?
            ORDER BY year DESC, round, category
        """, (college_id,))
        
        cutoffs = {}
        for row in cursor.fetchall():
            course_id, year, round_num, category, cutoff = row
            if year not in cutoffs:
                cutoffs[year] = {}
            if course_id not in cutoffs[year]:
                cutoffs[year][course_id] = {}
            if round_num not in cutoffs[year][course_id]:
                cutoffs[year][course_id][f"round{round_num}"] = {}
            cutoffs[year][course_id][f"round{round_num}"][category] = cutoff or 0
        
        conn.close()
        return cutoffs
    
    def calculate_college_statistics(self, seats_data: Dict, cutoffs_data: Dict) -> Dict:
        """Calculate statistics for a college"""
        stats = {
            "total_seats_2024": 0,
            "total_seats_2023": 0,
            "average_cutoff_2024": 0,
            "average_cutoff_2023": 0,
            "competition_ratio_2024": 0,
            "competition_ratio_2023": 0
        }
        
        # Calculate seat statistics
        if "2024" in seats_data:
            stats["total_seats_2024"] = sum(
                course_data.get("total", 0) 
                for course_data in seats_data["2024"].values()
            )
        
        if "2023" in seats_data:
            stats["total_seats_2023"] = sum(
                course_data.get("total", 0) 
                for course_data in seats_data["2023"].values()
            )
        
        # Calculate cutoff statistics
        if "2024" in cutoffs_data:
            cutoff_values = []
            for course_data in cutoffs_data["2024"].values():
                for round_data in course_data.values():
                    for category, cutoff in round_data.items():
                        if cutoff > 0:
                            cutoff_values.append(cutoff)
            
            if cutoff_values:
                stats["average_cutoff_2024"] = sum(cutoff_values) / len(cutoff_values)
        
        return stats
    
    async def generate_all_college_data(self, colleges: List[Dict]):
        """Generate data files for all colleges"""
        logger.info("🔄 Generating individual college data files...")
        
        # Process colleges in batches for better performance
        batch_size = 50
        for i in range(0, len(colleges), batch_size):
            batch = colleges[i:i + batch_size]
            
            # Create tasks for concurrent processing
            tasks = []
            for college in batch:
                task = self.generate_college_data_by_id(college["id"])
                tasks.append(task)
            
            # Process batch concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Write results to files
            for j, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"❌ Error processing college {batch[j]['id']}: {result}")
                    continue
                
                college_id = batch[j]["id"]
                file_path = self.data_dir / 'colleges' / f'{college_id}.json'
                
                async with aiofiles.open(file_path, 'w') as f:
                    await f.write(json.dumps(result, indent=2, ensure_ascii=False))
                
                self.stats['colleges_processed'] += 1
            
            logger.info(f"✅ Processed batch {i//batch_size + 1}: {len(batch)} colleges")
    
    async def generate_search_index(self, colleges: List[Dict], courses: List[Dict]):
        """Generate search index with master names"""
        logger.info("🔄 Generating search index...")
        
        # College search index
        college_index = []
        for college in colleges:
            searchable_text = f"{college['display_name']} {college['city']} {college['state']} {college['management_type']}"
            college_index.append({
                "id": college["id"],
                "display_name": college["display_name"],
                "city": college["city"],
                "state": college["state"],
                "management_type": college["management_type"],
                "searchable_text": searchable_text
            })
        
        # Course search index
        course_index = []
        for course in courses:
            searchable_text = f"{course['display_name']} {course['stream']} {course['branch']}"
            course_index.append({
                "id": course["id"],
                "display_name": course["display_name"],
                "stream": course["stream"],
                "branch": course["branch"],
                "searchable_text": searchable_text
            })
        
        # Write search indices
        async with aiofiles.open(self.search_dir / 'colleges-index.json', 'w') as f:
            await f.write(json.dumps(college_index, indent=2, ensure_ascii=False))
        
        async with aiofiles.open(self.search_dir / 'courses-index.json', 'w') as f:
            await f.write(json.dumps(course_index, indent=2, ensure_ascii=False))
        
        logger.info(f"✅ Generated search indices: {len(college_index)} colleges, {len(course_index)} courses")
    
    async def run(self):
        """Run the complete master data generation process"""
        logger.info("🚀 Starting master data generation...")
        
        try:
            # Generate master data
            colleges = await self.generate_master_colleges()
            courses = await self.generate_master_courses()
            
            # Generate individual data files
            await self.generate_all_college_data(colleges)
            
            # Generate search indices
            await self.generate_search_index(colleges, courses)
            
            # Print final statistics
            end_time = datetime.now()
            duration = end_time - self.stats['start_time']
            
            logger.info("🎉 Master data generation completed!")
            logger.info(f"📊 Statistics:")
            logger.info(f"   - Colleges processed: {self.stats['colleges_processed']}")
            logger.info(f"   - Courses processed: {len(courses)}")
            logger.info(f"   - Duration: {duration}")
            logger.info(f"   - Output directory: {self.output_dir}")
            
        except Exception as e:
            logger.error(f"❌ Master data generation failed: {e}")
            raise

async def main():
    generator = MasterDataGenerator()
    await generator.run()

if __name__ == "__main__":
    asyncio.run(main())
