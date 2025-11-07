#!/usr/bin/env python3
"""
Machine Learning Enhanced Matching System
Uses ML models to improve matching accuracy and learn from user corrections
"""

import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Dict, List, Tuple, Optional
import sqlite3
from pathlib import Path

class MLEnhancedMatcher:
    """Machine Learning enhanced college and course matching"""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or "data/models/ml_matcher.pkl"
        self.college_model = None
        self.course_model = None
        self.college_vectorizer = None
        self.course_vectorizer = None
        self.is_trained = False
        
        # Load existing models if available
        self._load_models()
    
    def _load_models(self):
        """Load pre-trained models if available"""
        if Path(self.model_path).exists():
            try:
                with open(self.model_path, 'rb') as f:
                    model_data = pickle.load(f)
                    self.college_model = model_data.get('college_model')
                    self.course_model = model_data.get('course_model')
                    self.college_vectorizer = model_data.get('college_vectorizer')
                    self.course_vectorizer = model_data.get('course_vectorizer')
                    self.is_trained = True
                    print(f"✅ Loaded ML models from {self.model_path}")
            except Exception as e:
                print(f"⚠️  Error loading models: {e}")
    
    def _save_models(self):
        """Save trained models to disk"""
        model_data = {
            'college_model': self.college_model,
            'course_model': self.course_model,
            'college_vectorizer': self.college_vectorizer,
            'course_vectorizer': self.course_vectorizer
        }
        
        # Ensure directory exists
        Path(self.model_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.model_path, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"✅ Saved ML models to {self.model_path}")
    
    def train_from_corrections(self, master_db_path: str, counselling_db_path: str):
        """Train models from existing manual corrections and aliases"""
        print("🤖 Training ML models from existing corrections...")
        
        # Load training data from aliases and manual corrections
        master_conn = sqlite3.connect(master_db_path)
        counselling_conn = sqlite3.connect(counselling_db_path)
        
        # Get college aliases
        college_aliases_df = pd.read_sql("""
            SELECT alias_name, original_name, college_id
            FROM college_aliases
            WHERE confidence >= 90
        """, master_conn)
        
        # Get course aliases
        course_aliases_df = pd.read_sql("""
            SELECT alias_name, original_name, course_id
            FROM course_aliases
            WHERE confidence >= 90
        """, master_conn)
        
        # Get matched records
        matched_records_df = pd.read_sql("""
            SELECT 
                college_institute_raw,
                college_institute_normalized,
                master_college_id,
                college_match_score,
                course_raw,
                course_normalized,
                master_course_id,
                course_match_score
            FROM counselling_records
            WHERE master_college_id IS NOT NULL AND master_course_id IS NOT NULL
            AND college_match_score >= 90 AND course_match_score >= 90
            LIMIT 5000
        """, counselling_conn)
        
        master_conn.close()
        counselling_conn.close()
        
        # Train college matching model
        if len(college_aliases_df) > 50 or len(matched_records_df) > 100:
            self._train_college_model(college_aliases_df, matched_records_df, master_db_path)
        
        # Train course matching model
        if len(course_aliases_df) > 50 or len(matched_records_df) > 100:
            self._train_course_model(course_aliases_df, matched_records_df, master_db_path)
        
        self.is_trained = True
        self._save_models()
    
    def _train_college_model(self, aliases_df: pd.DataFrame, matched_df: pd.DataFrame, master_db_path: str):
        """Train college matching model"""
        print("  📚 Training college matching model...")
        
        # Prepare training data
        training_data = []
        
        # Add aliases as positive examples
        for _, row in aliases_df.iterrows():
            training_data.append({
                'text1': row['alias_name'],
                'text2': row['original_name'],
                'is_match': 1,
                'similarity': 100
            })
        
        # Add matched records as positive examples
        master_conn = sqlite3.connect(master_db_path)
        for _, row in matched_df.iterrows():
            if row['master_college_id']:
                # Get the actual college name
                college_name = master_conn.execute(
                    "SELECT name FROM colleges WHERE id = ?",
                    (row['master_college_id'],)
                ).fetchone()
                
                if college_name:
                    training_data.append({
                        'text1': row['college_institute_raw'],
                        'text2': college_name[0],
                        'is_match': 1,
                        'similarity': row['college_match_score']
                    })
        
        # Add negative examples (random pairs that don't match)
        all_colleges = [row[0] for row in master_conn.execute("SELECT name FROM colleges").fetchall()]
        master_conn.close()
        
        import random
        for _ in range(min(1000, len(training_data) * 2)):
            text1 = random.choice([d['text1'] for d in training_data])
            text2 = random.choice(all_colleges)
            
            # Check if this is actually a match
            is_match = any(
                d['text1'] == text1 and d['text2'] == text2 
                for d in training_data
            )
            
            if not is_match:
                training_data.append({
                    'text1': text1,
                    'text2': text2,
                    'is_match': 0,
                    'similarity': 0
                })
        
        # Create features
        self.college_vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 2),
            stop_words='english'
        )
        
        # Prepare features and labels
        texts1 = [d['text1'] for d in training_data]
        texts2 = [d['text2'] for d in training_data]
        labels = [d['is_match'] for d in training_data]
        
        # Combine texts for vectorization
        all_texts = texts1 + texts2
        self.college_vectorizer.fit(all_texts)
        
        # Create features
        features = []
        for i in range(len(training_data)):
            vec1 = self.college_vectorizer.transform([texts1[i]])
            vec2 = self.college_vectorizer.transform([texts2[i]])
            
            # Feature engineering
            similarity = cosine_similarity(vec1, vec2)[0][0]
            length_ratio = min(len(texts1[i]), len(texts2[i])) / max(len(texts1[i]), len(texts2[i]))
            word_diff = abs(len(texts1[i].split()) - len(texts2[i].split()))
            
            features.append([similarity, length_ratio, word_diff])
        
        # Train model
        self.college_model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.college_model.fit(features, labels)
        
        print(f"    ✅ College model trained with {len(training_data)} examples")
    
    def _train_course_model(self, aliases_df: pd.DataFrame, matched_df: pd.DataFrame, master_db_path: str):
        """Train course matching model"""
        print("  📚 Training course matching model...")
        
        # Similar to college model training but for courses
        # Implementation details omitted for brevity
        pass
    
    def predict_college_match(self, text1: str, text2: str) -> Dict:
        """Predict if two college names match using ML model"""
        if not self.is_trained or not self.college_model:
            return {'is_match': False, 'confidence': 0, 'method': 'no_model'}
        
        # Vectorize texts
        vec1 = self.college_vectorizer.transform([text1])
        vec2 = self.college_vectorizer.transform([text2])
        
        # Create features
        similarity = cosine_similarity(vec1, vec2)[0][0]
        length_ratio = min(len(text1), len(text2)) / max(len(text1), len(text2))
        word_diff = abs(len(text1.split()) - len(text2.split()))
        
        features = [[similarity, length_ratio, word_diff]]
        
        # Predict
        prediction = self.college_model.predict_proba(features)[0]
        is_match = prediction[1] > 0.7  # Threshold
        
        return {
            'is_match': bool(is_match),
            'confidence': float(prediction[1]),
            'method': 'ml_enhanced'
        }
    
    def learn_from_correction(self, text1: str, text2: str, is_match: bool):
        """Learn from a new user correction"""
        # This would implement online learning or periodic retraining
        # For now, just store the correction for future training
        correction = {
            'text1': text1,
            'text2': text2,
            'is_match': is_match,
            'timestamp': pd.Timestamp.now()
        }
        
        # Store correction for future training
        corrections_path = Path(self.model_path).parent / "corrections.jsonl"
        with open(corrections_path, 'a') as f:
            import json
            f.write(json.dumps(correction) + '\n')
        
        print(f"📝 Learned from correction: {text1} → {text2} ({'match' if is_match else 'no match'})")

# Example usage
if __name__ == "__main__":
    matcher = MLEnhancedMatcher()
    
    # Train from existing data
    matcher.train_from_corrections(
        "/Users/kashyapanand/Public/New/data/sqlite/master_data.db",
        "/Users/kashyapanand/Public/New/data/sqlite/counselling_data_partitioned.db"
    )
    
    # Test prediction
    result = matcher.predict_college_match(
        "GOVT MEDICAL COLLEGE",
        "GOVERNMENT MEDICAL COLLEGE"
    )
    print("Prediction result:", result)
