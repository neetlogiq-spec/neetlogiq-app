#!/usr/bin/env python3
"""
Fix broken word fragments in normalized_college_name.

Problem: Source data has words broken by spaces like:
  "VARDH MAN INSTITU TE" instead of "VARDHMAN INSTITUTE"
  "GOVER NMENT MEDICA L COLLEG E" instead of "GOVERNMENT MEDICAL COLLEGE"

Solution: Merge single/double-character fragments with adjacent words.
"""

import sqlite3
import re

def fix_broken_words(text):
    """
    Merge single/double-character word fragments.
    
    Examples:
        "VARDH MAN INSTITU TE" -> "VARDHMAN INSTITUTE"
        "GOVER NMENT MEDICA L" -> "GOVERNMENT MEDICAL"
    """
    if not text:
        return text
    
    # Split into words
    words = text.split()
    if len(words) <= 1:
        return text
    
    # Merge fragments
    result = []
    i = 0
    
    while i < len(words):
        current = words[i]
        
        # Look ahead for fragments to merge
        while i + 1 < len(words):
            next_word = words[i + 1]
            
            # If next word is short (1-3 chars) and current doesn't end with common suffixes
            # then it's likely a broken fragment
            if len(next_word) <= 3 and next_word.isalpha():
                # Check if it looks like a fragment (not a valid short word)
                valid_short_words = {'OF', 'AND', 'THE', 'FOR', 'PVT', 'LTD', 'DR', 'MR', 'MS', 'NO'}
                if next_word not in valid_short_words:
                    current = current + next_word
                    i += 1
                    continue
            
            # If current word ends abruptly (consonant cluster) and next word starts that way
            # it might be broken
            break
        
        result.append(current)
        i += 1
    
    return ' '.join(result)


def fix_database(db_path, table='group_matching_queue', dry_run=True):
    """Fix broken words in a database table."""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all records with potential broken words
    cursor.execute(f"""
        SELECT group_id, normalized_college_name 
        FROM {table}
        WHERE normalized_college_name LIKE '% A %'
           OR normalized_college_name LIKE '% E %'
           OR normalized_college_name LIKE '% L %'
           OR normalized_college_name LIKE '% N %'
           OR normalized_college_name LIKE '% R %'
           OR normalized_college_name LIKE '% S %'
           OR normalized_college_name LIKE '% Y %'
    """)
    
    rows = cursor.fetchall()
    print(f"Found {len(rows)} records with potential broken words")
    
    fixed_count = 0
    for group_id, name in rows:
        fixed_name = fix_broken_words(name)
        
        if fixed_name != name:
            print(f"  {group_id}: '{name[:50]}...'")
            print(f"       -> '{fixed_name[:50]}...'")
            
            if not dry_run:
                cursor.execute(f"""
                    UPDATE {table}
                    SET normalized_college_name = ?
                    WHERE group_id = ?
                """, (fixed_name, group_id))
            
            fixed_count += 1
    
    if not dry_run:
        conn.commit()
        print(f"\n✅ Fixed {fixed_count} records")
    else:
        print(f"\n[DRY RUN] Would fix {fixed_count} records")
        print("Run with dry_run=False to apply changes")
    
    conn.close()
    return fixed_count


if __name__ == "__main__":
    import sys
    
    # Test the fix function
    test_cases = [
        "VARDH MAN INSTITU TE OF MEDICA L SCIENC ES",
        "GOVER NMENT MEDICA L COLLEG E",
        "DR RADHAKRI SHNAN GOVERNMENT MEDICAL COLLEGE",
        "LOKMAN YA TILAK MEDICA L COLLEG E MUMBAI",
        "GOVERNMENT MEDICAL COLLEGE",  # Should not change
    ]
    
    print("Testing fix_broken_words():")
    for test in test_cases:
        fixed = fix_broken_words(test)
        marker = "✅" if fixed != test else "  "
        print(f"  {marker} '{test[:40]}...' -> '{fixed[:40]}...'")
    
    print("\n" + "="*60)
    
    # Check counselling database
    print("\nChecking counselling_data_partitioned.db (DRY RUN):")
    fix_database(
        'data/sqlite/counselling_data_partitioned.db',
        table='group_matching_queue',
        dry_run=True
    )
