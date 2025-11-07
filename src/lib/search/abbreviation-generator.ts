// Advanced abbreviation generator for medical colleges and courses
export class AbbreviationGenerator {
  private static commonWords = new Set([
    'OF', 'AND', 'THE', 'FOR', 'IN', 'AT', 'TO', 'A', 'AN', 'OR', 'BUT', 'WITH', 'BY'
  ]);

  private static medicalTerms = new Map([
    ['MEDICAL', 'MED'],
    ['COLLEGE', 'COLL'],
    ['INSTITUTE', 'INST'],
    ['UNIVERSITY', 'UNIV'],
    ['HOSPITAL', 'HOSP'],
    ['RESEARCH', 'RES'],
    ['CENTRE', 'CTR'],
    ['CENTER', 'CTR'],
    ['SCIENCES', 'SCI'],
    ['EDUCATION', 'EDU'],
    ['POSTGRADUATE', 'PG'],
    ['UNDERGRADUATE', 'UG'],
    ['DIPLOMA', 'DIP'],
    ['DEGREE', 'DEG'],
    ['BACHELOR', 'BACH'],
    ['MASTER', 'MSTR'],
    ['DOCTOR', 'DR'],
    ['PROFESSOR', 'PROF'],
    ['DEPARTMENT', 'DEPT'],
    ['FACULTY', 'FAC'],
    ['STUDIES', 'STUD'],
    ['TECHNOLOGY', 'TECH'],
    ['ENGINEERING', 'ENG'],
    ['MANAGEMENT', 'MGMT'],
    ['ADMINISTRATION', 'ADMIN'],
    ['GOVERNMENT', 'GOVT'],
    ['PRIVATE', 'PVT'],
    ['PUBLIC', 'PUB'],
    ['SOCIETY', 'SOC'],
    ['TRUST', 'TRST'],
    ['FOUNDATION', 'FOUND'],
    ['ASSOCIATION', 'ASSOC'],
    ['ORGANIZATION', 'ORG'],
    ['COMMITTEE', 'COMM'],
    ['BOARD', 'BRD'],
    ['COUNCIL', 'COUNCIL'],
    ['ACADEMY', 'ACAD'],
    ['SCHOOL', 'SCH'],
    ['HIGHER', 'HIGH'],
    ['SECONDARY', 'SEC'],
    ['PRIMARY', 'PRIM'],
    ['ELEMENTARY', 'ELEM'],
    ['NURSING', 'NURS'],
    ['PHARMACY', 'PHARM'],
    ['DENTAL', 'DENT'],
    ['PHYSIOTHERAPY', 'PHYSIO'],
    ['OCCUPATIONAL', 'OCCUP'],
    ['SPEECH', 'SPEECH'],
    ['AUDIOLOGY', 'AUDIO'],
    ['OPTOMETRY', 'OPTO'],
    ['RADIOLOGY', 'RADIO'],
    ['PATHOLOGY', 'PATH'],
    ['MICROBIOLOGY', 'MICRO'],
    ['BIOCHEMISTRY', 'BIOCHEM'],
    ['PHARMACOLOGY', 'PHARMACO'],
    ['ANATOMY', 'ANAT'],
    ['PHYSIOLOGY', 'PHYSIO'],
    ['BIOCHEMISTRY', 'BIOCHEM'],
    ['COMMUNITY', 'COMM'],
    ['PREVENTIVE', 'PREV'],
    ['SOCIAL', 'SOC'],
    ['BEHAVIORAL', 'BEHAV'],
    ['MENTAL', 'MENT'],
    ['PSYCHIATRY', 'PSYCH'],
    ['PSYCHOLOGY', 'PSYCHOL'],
    ['NEUROLOGY', 'NEURO'],
    ['NEUROSURGERY', 'NEUROSURG'],
    ['CARDIOLOGY', 'CARDIO'],
    ['CARDIAC', 'CARD'],
    ['PEDIATRICS', 'PED'],
    ['PEDIATRIC', 'PED'],
    ['GYNECOLOGY', 'GYNEC'],
    ['OBSTETRICS', 'OBSTET'],
    ['ORTHOPEDICS', 'ORTHO'],
    ['ORTHOPEDIC', 'ORTHO'],
    ['OPHTHALMOLOGY', 'OPHTHAL'],
    ['ENT', 'ENT'],
    ['DERMATOLOGY', 'DERMAT'],
    ['UROLOGY', 'URO'],
    ['NEPHROLOGY', 'NEPHRO'],
    ['GASTROENTEROLOGY', 'GASTRO'],
    ['PULMONOLOGY', 'PULMO'],
    ['ENDOCRINOLOGY', 'ENDO'],
    ['RHEUMATOLOGY', 'RHEUM'],
    ['HEMATOLOGY', 'HEMAT'],
    ['ONCOLOGY', 'ONCO'],
    ['RADIOTHERAPY', 'RADIO'],
    ['ANESTHESIOLOGY', 'ANESTH'],
    ['ANESTHESIA', 'ANESTH'],
    ['SURGERY', 'SURG'],
    ['GENERAL', 'GEN'],
    ['EMERGENCY', 'EMER'],
    ['CRITICAL', 'CRIT'],
    ['INTENSIVE', 'INTENS'],
    ['CARE', 'CARE'],
    ['UNIT', 'UNIT'],
    ['WARD', 'WARD'],
    ['CLINIC', 'CLIN'],
    ['DISPENSARY', 'DISP'],
    ['PHARMACY', 'PHARM'],
    ['LABORATORY', 'LAB'],
    ['DIAGNOSTIC', 'DIAG'],
    ['THERAPEUTIC', 'THERAP'],
    ['REHABILITATION', 'REHAB'],
    ['PHYSIOTHERAPY', 'PHYSIO'],
    ['OCCUPATIONAL', 'OCCUP'],
    ['THERAPY', 'THERAP']
  ]);

  // Generate multiple abbreviation variations
  static generateAbbreviations(fullName: string): string[] {
    const abbreviations = new Set<string>();
    const normalizedName = fullName.toUpperCase().trim();

    // Method 1: First letters of all words
    const allWords = normalizedName.split(/\s+/);
    if (allWords.length > 1) {
      const firstLetters = allWords.map(word => word.charAt(0)).join('');
      if (firstLetters.length >= 2) {
        abbreviations.add(firstLetters);
      }
    }

    // Method 2: First letters of significant words (skip common words)
    const significantWords = allWords.filter(word => 
      !this.commonWords.has(word) && word.length > 1
    );
    if (significantWords.length > 1) {
      const significantAbbr = significantWords.map(word => word.charAt(0)).join('');
      if (significantAbbr.length >= 2 && significantAbbr !== firstLetters) {
        abbreviations.add(significantAbbr);
      }
    }

    // Method 3: Medical term abbreviations
    const medicalAbbr = this.generateMedicalAbbreviations(normalizedName);
    medicalAbbr.forEach(abbr => abbreviations.add(abbr));

    // Method 4: Common patterns
    const patternAbbr = this.generatePatternAbbreviations(normalizedName);
    patternAbbr.forEach(abbr => abbreviations.add(abbr));

    return Array.from(abbreviations);
  }

  // Generate medical term abbreviations
  private static generateMedicalAbbreviations(name: string): string[] {
    const abbreviations = new Set<string>();
    
    this.medicalTerms.forEach((abbr, term) => {
      if (name.includes(term)) {
        abbreviations.add(abbr);
        
        // Create combination with location/name
        const words = name.split(/\s+/);
        const firstWord = words[0];
        if (firstWord && firstWord.length > 2) {
          abbreviations.add(firstWord + abbr);
        }
      }
    });

    return Array.from(abbreviations);
  }

  // Generate pattern-based abbreviations
  private static generatePatternAbbreviations(name: string): string[] {
    const abbreviations = new Set<string>();
    
    // Pattern: First word + Medical term
    if (name.includes('MEDICAL COLLEGE')) {
      const words = name.split(/\s+/);
      const firstWord = words[0];
      if (firstWord && firstWord.length > 1) {
        abbreviations.add(firstWord + 'MC');
      }
    }

    // Pattern: Government Medical College
    if (name.includes('GOVERNMENT MEDICAL COLLEGE')) {
      abbreviations.add('GMC');
    }

    // Pattern: Institute of Medical Sciences
    if (name.includes('INSTITUTE OF MEDICAL SCIENCES')) {
      const words = name.split(/\s+/);
      const firstWord = words[0];
      if (firstWord && firstWord.length > 1) {
        abbreviations.add(firstWord + 'IMS');
      }
    }

    return Array.from(abbreviations);
  }
}
