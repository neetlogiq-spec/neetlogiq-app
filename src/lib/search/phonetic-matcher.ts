// Phonetic matching for medical terms and college names
export class PhoneticMatcher {
  private static soundexMap = new Map([
    ['B', '1'], ['F', '1'], ['P', '1'], ['V', '1'],
    ['C', '2'], ['G', '2'], ['J', '2'], ['K', '2'], ['Q', '2'], ['S', '2'], ['X', '2'], ['Z', '2'],
    ['D', '3'], ['T', '3'],
    ['L', '4'],
    ['M', '5'], ['N', '5'],
    ['R', '6']
  ]);

  // Generate Soundex code for phonetic matching
  static generateSoundex(text: string): string {
    const normalized = text.toUpperCase().replace(/[^A-Z]/g, '');
    if (!normalized) return '';

    let soundex = normalized[0];
    let previousCode = '';

    for (let i = 1; i < normalized.length && soundex.length < 4; i++) {
      const char = normalized[i];
      const code = this.soundexMap.get(char) || '';

      if (code && code !== previousCode) {
        soundex += code;
        previousCode = code;
      }
    }

    return soundex.padEnd(4, '0');
  }

  // Generate multiple phonetic variations
  static generatePhoneticVariations(text: string): string[] {
    const variations = new Set<string>();
    const normalized = text.toUpperCase().trim();

    // Original Soundex
    variations.add(this.generateSoundex(normalized));

    // Remove common words and generate Soundex
    const withoutCommon = normalized.replace(/\b(OF|AND|THE|FOR|IN|AT|TO|A|AN)\b/g, ' ').trim();
    if (withoutCommon !== normalized) {
      variations.add(this.generateSoundex(withoutCommon));
    }

    // Generate variations for common medical terms
    const medicalVariations = this.generateMedicalPhoneticVariations(normalized);
    medicalVariations.forEach(variation => variations.add(variation));

    return Array.from(variations);
  }

  // Generate phonetic variations for medical terms
  private static generateMedicalPhoneticVariations(text: string): string[] {
    const variations = new Set<string>();

    // Common medical term phonetic patterns
    const medicalPatterns = [
      { pattern: /MEDICAL/gi, replacement: 'MED' },
      { pattern: /COLLEGE/gi, replacement: 'COLL' },
      { pattern: /INSTITUTE/gi, replacement: 'INST' },
      { pattern: /UNIVERSITY/gi, replacement: 'UNIV' },
      { pattern: /HOSPITAL/gi, replacement: 'HOSP' },
      { pattern: /RESEARCH/gi, replacement: 'RES' },
      { pattern: /SCIENCES/gi, replacement: 'SCI' },
      { pattern: /EDUCATION/gi, replacement: 'EDU' }
    ];

    medicalPatterns.forEach(({ pattern, replacement }) => {
      const modified = text.replace(pattern, replacement);
      if (modified !== text) {
        variations.add(this.generateSoundex(modified));
      }
    });

    return Array.from(variations);
  }

  // Check if two texts are phonetically similar
  static arePhoneticallySimilar(text1: string, text2: string, threshold: number = 0.8): boolean {
    const soundex1 = this.generateSoundex(text1);
    const soundex2 = this.generateSoundex(text2);

    if (soundex1 === soundex2) return true;

    // Calculate similarity based on common characters
    const commonChars = this.countCommonCharacters(soundex1, soundex2);
    const maxLength = Math.max(soundex1.length, soundex2.length);
    const similarity = commonChars / maxLength;

    return similarity >= threshold;
  }

  // Count common characters between two strings
  private static countCommonCharacters(str1: string, str2: string): number {
    let count = 0;
    const minLength = Math.min(str1.length, str2.length);

    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        count++;
      }
    }

    return count;
  }
}
