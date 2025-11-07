const fs = require('fs');
const path = require('path');

// Read individual master data files
const statesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/master/states.json'), 'utf8'));
const categoriesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/master/categories.json'), 'utf8'));
const quotasData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/master/quotas.json'), 'utf8'));
const coursesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/master/courses.json'), 'utf8'));
const collegesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/master/colleges.json'), 'utf8'));

// Transform data to expected format
const masterData = {
  states: Object.values(statesData).map(state => ({
    id: state.id,
    name: state.name
  })),
  categories: Object.values(categoriesData).map(category => ({
    id: category.id,
    name: category.name
  })),
  quotas: Object.values(quotasData).map(quota => ({
    id: quota.id,
    name: quota.name
  })),
  courses: Object.values(coursesData).map(course => ({
    id: course.id,
    name: course.name,
    stream: course.domain || 'MEDICAL'
  })),
  colleges: Object.values(collegesData).map(college => ({
    id: college.id,
    name: college.name,
    state_id: college.state,
    management_type: college.management
  }))
};

// Write the combined master data file
const outputPath = path.join(__dirname, '../public/data/json/master-data.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(masterData, null, 2));

console.log('Master data file generated successfully at:', outputPath);
console.log('States:', masterData.states.length);
console.log('Categories:', masterData.categories.length);
console.log('Quotas:', masterData.quotas.length);
console.log('Courses:', masterData.courses.length);
console.log('Colleges:', masterData.colleges.length);


