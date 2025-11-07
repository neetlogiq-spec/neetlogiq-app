import fs from 'fs';
import path from 'path';
import * as parquet from 'parquetjs';

async function main() {
  console.log('🚀 Node.js Parquet Conversion...');
  console.log('==================================');

  const dataDir = path.join(process.cwd(), 'data');
  const parquetDir = path.join(dataDir, 'parquet');

  try {
    // Ensure parquet directory exists
    if (!fs.existsSync(parquetDir)) {
      fs.mkdirSync(parquetDir, { recursive: true });
    }

    // Read JSON data
    console.log('📊 Reading JSON data...');
    const colleges = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_colleges.json'), 'utf8'));
    const courses = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_courses.json'), 'utf8'));
    const seatData = JSON.parse(fs.readFileSync(path.join(dataDir, 'unified_seat_data.json'), 'utf8'));
    const dnbAggregations = JSON.parse(fs.readFileSync(path.join(dataDir, 'dnb_aggregations.json'), 'utf8'));

    // Define schemas
    const collegeSchema = new parquet.ParquetSchema({
      id: { type: 'UTF8' },
      name: { type: 'UTF8' },
      fullName: { type: 'UTF8', optional: true },
      type: { type: 'UTF8' },
      state: { type: 'UTF8', optional: true },
      address: { type: 'UTF8', optional: true },
      city: { type: 'UTF8', optional: true },
      pincode: { type: 'UTF8', optional: true },
      university: { type: 'UTF8', optional: true },
      management: { type: 'UTF8', optional: true },
      establishedYear: { type: 'INT32', optional: true },
      website: { type: 'UTF8', optional: true },
      phone: { type: 'UTF8', optional: true },
      email: { type: 'UTF8', optional: true },
      isActive: { type: 'BOOLEAN' },
      sourceFile: { type: 'UTF8' },
      createdAt: { type: 'UTF8' },
      updatedAt: { type: 'UTF8' },
      dnbCode: { type: 'UTF8', optional: true }
    });

    const courseSchema = new parquet.ParquetSchema({
      id: { type: 'UTF8' },
      name: { type: 'UTF8' },
      type: { type: 'UTF8' },
      isActive: { type: 'BOOLEAN' },
      createdAt: { type: 'UTF8' },
      updatedAt: { type: 'UTF8' }
    });

    const seatDataSchema = new parquet.ParquetSchema({
      id: { type: 'UTF8' },
      collegeId: { type: 'UTF8' },
      courseId: { type: 'UTF8' },
      seats: { type: 'INT32' },
      year: { type: 'INT32' },
      sourceFile: { type: 'UTF8' },
      createdAt: { type: 'UTF8' },
      updatedAt: { type: 'UTF8' }
    });

    const dnbAggregationSchema = new parquet.ParquetSchema({
      collegeId: { type: 'UTF8' },
      courseId: { type: 'UTF8' },
      totalSeats: { type: 'INT32' },
      categories: { type: 'UTF8' } // JSON string
    });

    // Convert colleges
    console.log(`📊 Converting ${colleges.length} colleges to Parquet...`);
    const collegeWriter = await parquet.ParquetWriter.openFile(collegeSchema, path.join(parquetDir, 'colleges.parquet'));
    for (const college of colleges) {
      await collegeWriter.appendRow(college);
    }
    await collegeWriter.close();

    // Convert courses
    console.log(`📊 Converting ${courses.length} courses to Parquet...`);
    const courseWriter = await parquet.ParquetWriter.openFile(courseSchema, path.join(parquetDir, 'courses.parquet'));
    for (const course of courses) {
      await courseWriter.appendRow(course);
    }
    await courseWriter.close();

    // Convert seat data
    console.log(`📊 Converting ${seatData.length} seat records to Parquet...`);
    const seatDataWriter = await parquet.ParquetWriter.openFile(seatDataSchema, path.join(parquetDir, 'seat_data.parquet'));
    for (const record of seatData) {
      await seatDataWriter.appendRow(record);
    }
    await seatDataWriter.close();

    // Convert DNB aggregations
    console.log(`📊 Converting ${dnbAggregations.length} DNB aggregations to Parquet...`);
    const dnbWriter = await parquet.ParquetWriter.openFile(dnbAggregationSchema, path.join(parquetDir, 'dnb_aggregations.parquet'));
    for (const agg of dnbAggregations) {
      await dnbWriter.appendRow({
        ...agg,
        categories: JSON.stringify(agg.categories)
      });
    }
    await dnbWriter.close();

    console.log('✅ Successfully converted to Parquet format!');
    console.log(`📁 Parquet files created in: ${parquetDir}`);

    // List created files
    const files = fs.readdirSync(parquetDir);
    console.log('\n📁 Created files:');
    files.forEach(file => {
      const filePath = path.join(parquetDir, file);
      const stats = fs.statSync(filePath);
      console.log(`   ${file}: ${(stats.size / 1024).toFixed(1)} KB`);
    });

    // Create summary
    const summary = {
      createdAt: new Date().toISOString(),
      totalColleges: colleges.length,
      totalCourses: courses.length,
      totalSeatRecords: seatData.length,
      totalDnbAggregations: dnbAggregations.length,
      files: files.map(file => ({
        name: file,
        size: fs.statSync(path.join(parquetDir, file)).size
      }))
    };

    fs.writeFileSync(path.join(parquetDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log('\n📊 Summary created: summary.json');

  } catch (error: any) {
    console.error('❌ Parquet conversion failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
