export interface CutoffData {
  id: string;
  college: string;
  course: string;
  stream: string;
  state: string;
  counsellingBody: string;
  collegeType: string;
  year: number;
  round: number;
  openingRank: number;
  closingRank: number;
  totalSeats: number;
  category: string;
  quota: string;
}

const colleges = [
  'AIIMS Delhi', 'AIIMS New Delhi', 'AIIMS Mangalagiri', 'AIIMS Nagpur', 'AIIMS Gorakhpur',
  'All India Institute of Medical Sciences (AIIMS) Jodhpur', 'AIIMS Rishikesh', 'AIIMS Patna',
  'Maulana Azad Medical College', 'Lady Hardinge Medical College', 'VMMC & Safdarjung Hospital',
  'University College of Medical Sciences', 'PGIMER Chandigarh', 'JIPMER Puducherry',
  'King George Medical University', 'Grant Medical College', 'Seth G.S. Medical College',
  'Armed Forces Medical College', 'BJ Medical College', 'King Edward Memorial Hospital',
  'Dayanand Medical College', 'Christian Medical College', 'Government Medical College',
  'Indira Gandhi Institute of Medical Sciences', 'Institute of Medical Sciences',
  'Rajendra Institute of Medical Sciences', 'Maulana Azad Institute of Dental Sciences',
  'SDM College of Dental Sciences', 'Manipal College of Dental Sciences', 'SRM Dental College',
  'Government Dental College', 'People College of Dental Sciences', 'USC School of Dentistry',
  'Boston University School of Dental Medicine', 'Harvard School of Dental Medicine',
  'New York University College of Dentistry', 'University of California Los Angeles'
];

const courses = ['MBBS', 'BDS', 'MD', 'MS', 'MDS', 'B.Sc Nursing', 'M.Sc Nursing', 'BPT', 'MPT'];
const streams = ['Medical', 'Dental', 'Nursing'];
const categories = ['General', 'OBC', 'SC', 'ST', 'EWS', 'PWD'];
const quotas = ['AIQ', 'State Quota', 'Management Quota'];
const states = [
  'Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Uttar Pradesh',
  'Bihar', 'Gujarat', 'Rajasthan', 'Punjab', 'Haryana', 'Kerala', 'Telangana',
  'Andhra Pradesh', 'Odisha', 'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand',
  'Assam', 'Himachal Pradesh', 'Uttarakhand', 'Goa', 'Manipur', 'Meghalaya', 'Tripura'
];
const counsellingBodies = ['MCC', 'State Counselling', 'NEET', 'Central Counselling'];
const collegeTypes = ['Government', 'Private', 'Deemed', 'Autonomous'];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCutoff(): CutoffData {
  const college = randomElement(colleges);
  const course = randomElement(courses);
  const stream = randomElement(streams);
  const state = randomElement(states);
  const category = randomElement(categories);
  const quota = randomElement(quotas);
  const year = 2024;
  const round = randomNumber(1, 8);
  const counsellingBody = randomElement(counsellingBodies);
  const collegeType = randomElement(collegeTypes);
  
  // Generate realistic rank range based on category and stream
  let baseOpeningRank = randomNumber(1, 50000);
  let baseClosingRank = baseOpeningRank + randomNumber(1000, 10000);
  
  // Adjust ranks based on category
  if (category === 'SC' || category === 'ST') {
    baseClosingRank *= 5; // Lower competition
  } else if (category === 'OBC') {
    baseClosingRank *= 2; // Medium competition
  }
  
  // Adjust ranks based on stream
  if (stream === 'Dental') {
    baseClosingRank *= 0.7; // Dental usually has lower ranks
  }
  
  const totalSeats = randomNumber(50, 300);
  
  return {
    id: `cutoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    college,
    course,
    stream,
    state,
    counsellingBody,
    collegeType,
    year,
    round,
    openingRank: baseOpeningRank,
    closingRank: baseClosingRank,
    totalSeats,
    category,
    quota,
  };
}

export function generateMockCutoffData(count: number = 1000): CutoffData[] {
  const data: CutoffData[] = [];
  
  for (let i = 0; i < count; i++) {
    data.push(generateCutoff());
  }
  
  return data;
}

// Specific mock data for popular colleges
export function generatePopularCutoffs(): CutoffData[] {
  const popularColleges = [
    { college: 'AIIMS Delhi', openingRank: 1, closingRank: 50, seats: 100 },
    { college: 'AIIMS New Delhi', openingRank: 51, closingRank: 120, seats: 100 },
    { college: 'Maulana Azad Medical College', openingRank: 121, closingRank: 500, seats: 150 },
    { college: 'Lady Hardinge Medical College', openingRank: 501, closingRank: 1500, seats: 120 },
    { college: 'VMMC & Safdarjung Hospital', openingRank: 1501, closingRank: 5000, seats: 200 },
    { college: 'Grant Medical College', openingRank: 5001, closingRank: 15000, seats: 180 },
    { college: 'Seth G.S. Medical College', openingRank: 15001, closingRank: 35000, seats: 200 },
    { college: 'King George Medical University', openingRank: 35001, closingRank: 80000, seats: 220 },
    { college: 'BJ Medical College', openingRank: 80001, closingRank: 150000, seats: 180 },
  ];
  
  return popularColleges.flatMap(({ college, openingRank, closingRank, seats }) => {
    const rounds = [];
    for (let round = 1; round <= 8; round++) {
      rounds.push({
        id: `${college}-round-${round}`,
        college,
        course: 'MBBS',
        stream: 'Medical',
        state: 'Delhi',
        counsellingBody: 'MCC',
        collegeType: 'Government',
        year: 2024,
        round,
        openingRank: Math.floor(openingRank + (round * 1000)),
        closingRank: Math.floor(closingRank + (round * 5000)),
        totalSeats: seats,
        category: 'General',
        quota: 'AIQ',
      });
    }
    return rounds;
  });
}

// Generate mock data for multiple years
export function generateMultiYearCutoffs(): CutoffData[] {
  const years = [2024, 2023, 2022];
  const data: CutoffData[] = [];
  
  years.forEach(year => {
    const yearData = generateMockCutoffData(300);
    data.push(...yearData.map(item => ({ ...item, year })));
  });
  
  return data;
}




















