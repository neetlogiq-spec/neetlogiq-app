#!/usr/bin/env python3
"""
Advanced Integrations Module
- Google Sheets Integration
- Geospatial Matching
- Excel Add-in Support
"""

import logging
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import json

logger = logging.getLogger(__name__)

# ============================================================================
# GOOGLE SHEETS INTEGRATION
# ============================================================================

class GoogleSheetsIntegration:
    """Google Sheets API integration for data import/export"""

    def __init__(self, credentials_path: str = 'credentials.json'):
        """
        Initialize Google Sheets integration

        Args:
            credentials_path: Path to Google API credentials JSON
        """
        self.credentials_path = Path(credentials_path)
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate with Google Sheets API"""
        try:
            from google.oauth2.credentials import Credentials
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            from google.auth.transport.requests import Request

            SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

            # Use service account credentials
            if self.credentials_path.exists():
                creds = service_account.Credentials.from_service_account_file(
                    str(self.credentials_path),
                    scopes=SCOPES
                )
                self.service = build('sheets', 'v4', credentials=creds)
                logger.info("Google Sheets API authenticated successfully")
            else:
                logger.warning(f"Credentials file not found: {self.credentials_path}")
                logger.info("Please download credentials from Google Cloud Console")

        except ImportError:
            logger.error("Google API client not installed. Install: pip install google-api-python-client google-auth")
        except Exception as e:
            logger.error(f"Google Sheets authentication failed: {e}")

    def read_sheet(
        self,
        spreadsheet_id: str,
        range_name: str = 'Sheet1!A:Z'
    ) -> List[List]:
        """
        Read data from Google Sheet

        Args:
            spreadsheet_id: Google Sheet ID (from URL)
            range_name: Range to read (e.g., 'Sheet1!A1:Z1000')

        Returns:
            List of rows
        """
        if not self.service:
            logger.error("Google Sheets service not initialized")
            return []

        try:
            result = self.service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name
            ).execute()

            values = result.get('values', [])
            logger.info(f"Read {len(values)} rows from Google Sheet")
            return values

        except Exception as e:
            logger.error(f"Error reading Google Sheet: {e}")
            return []

    def write_sheet(
        self,
        spreadsheet_id: str,
        range_name: str,
        values: List[List],
        value_input_option: str = 'RAW'
    ) -> bool:
        """
        Write data to Google Sheet

        Args:
            spreadsheet_id: Google Sheet ID
            range_name: Range to write to
            values: Data to write (2D list)
            value_input_option: 'RAW' or 'USER_ENTERED'

        Returns:
            Success status
        """
        if not self.service:
            logger.error("Google Sheets service not initialized")
            return False

        try:
            body = {'values': values}

            result = self.service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption=value_input_option,
                body=body
            ).execute()

            logger.info(f"Updated {result.get('updatedCells')} cells in Google Sheet")
            return True

        except Exception as e:
            logger.error(f"Error writing to Google Sheet: {e}")
            return False

    def append_sheet(
        self,
        spreadsheet_id: str,
        range_name: str,
        values: List[List]
    ) -> bool:
        """Append rows to Google Sheet"""
        if not self.service:
            return False

        try:
            body = {'values': values}

            result = self.service.spreadsheets().values().append(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption='RAW',
                body=body
            ).execute()

            logger.info(f"Appended {len(values)} rows to Google Sheet")
            return True

        except Exception as e:
            logger.error(f"Error appending to Google Sheet: {e}")
            return False

    def import_to_sqlite(
        self,
        spreadsheet_id: str,
        range_name: str,
        db_path: str,
        table_name: str
    ) -> int:
        """
        Import Google Sheet directly to SQLite

        Args:
            spreadsheet_id: Google Sheet ID
            range_name: Sheet range
            db_path: SQLite database path
            table_name: Table name

        Returns:
            Number of rows imported
        """
        import sqlite3
        import pandas as pd

        # Read from Google Sheets
        data = self.read_sheet(spreadsheet_id, range_name)

        if not data:
            return 0

        # Convert to DataFrame
        df = pd.DataFrame(data[1:], columns=data[0])

        # Import to SQLite
        conn = sqlite3.connect(db_path)
        df.to_sql(table_name, conn, if_exists='append', index=False)
        conn.close()

        logger.info(f"Imported {len(df)} rows to {table_name}")
        return len(df)

    def export_from_sqlite(
        self,
        db_path: str,
        table_name: str,
        spreadsheet_id: str,
        range_name: str,
        query: Optional[str] = None
    ) -> bool:
        """
        Export SQLite table to Google Sheets

        Args:
            db_path: SQLite database path
            table_name: Table name
            spreadsheet_id: Google Sheet ID
            range_name: Destination range
            query: Optional SQL query (default: SELECT * FROM table)

        Returns:
            Success status
        """
        import sqlite3
        import pandas as pd

        # Read from SQLite
        conn = sqlite3.connect(db_path)
        if query:
            df = pd.read_sql(query, conn)
        else:
            df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
        conn.close()

        # Convert to list of lists
        values = [df.columns.tolist()] + df.values.tolist()

        # Write to Google Sheets
        return self.write_sheet(spreadsheet_id, range_name, values)


# ============================================================================
# GEOSPATIAL MATCHING
# ============================================================================

class GeospatialMatcher:
    """Geospatial matching with distance calculations"""

    def __init__(self):
        """Initialize geospatial matcher"""
        self.geocode_cache = {}

    def geocode_address(self, address: str, city: str = '', state: str = '') -> Optional[Tuple[float, float]]:
        """
        Geocode an address to lat/long coordinates

        Args:
            address: Address string
            city: City
            state: State

        Returns:
            (latitude, longitude) or None
        """
        try:
            from geopy.geocoders import Nominatim
            from geopy.exc import GeocoderTimedOut

            # Build full address
            full_address = ', '.join(filter(None, [address, city, state, 'India']))

            # Check cache
            if full_address in self.geocode_cache:
                return self.geocode_cache[full_address]

            # Geocode
            geolocator = Nominatim(user_agent="medical_college_matcher")
            location = geolocator.geocode(full_address, timeout=10)

            if location:
                coords = (location.latitude, location.longitude)
                self.geocode_cache[full_address] = coords
                return coords
            else:
                return None

        except ImportError:
            logger.error("geopy not installed. Install: pip install geopy")
            return None
        except GeocoderTimedOut:
            logger.warning(f"Geocoding timeout for: {full_address}")
            return None
        except Exception as e:
            logger.error(f"Geocoding error: {e}")
            return None

    def calculate_distance(
        self,
        coords1: Tuple[float, float],
        coords2: Tuple[float, float],
        unit: str = 'km'
    ) -> float:
        """
        Calculate distance between two coordinates

        Args:
            coords1: (lat1, lon1)
            coords2: (lat2, lon2)
            unit: 'km' or 'miles'

        Returns:
            Distance in specified unit
        """
        try:
            from geopy.distance import geodesic

            distance_km = geodesic(coords1, coords2).kilometers

            if unit == 'miles':
                return distance_km * 0.621371
            else:
                return distance_km

        except ImportError:
            logger.error("geopy not installed")
            return float('inf')

    def match_by_proximity(
        self,
        query_coords: Tuple[float, float],
        candidates: List[Dict],
        max_distance_km: float = 50.0
    ) -> List[Tuple[Dict, float]]:
        """
        Match candidates by proximity

        Args:
            query_coords: Query coordinates (lat, lon)
            candidates: List of candidate dictionaries with 'latitude', 'longitude'
            max_distance_km: Maximum distance in kilometers

        Returns:
            List of (candidate, distance) tuples
        """
        matches = []

        for candidate in candidates:
            lat = candidate.get('latitude')
            lon = candidate.get('longitude')

            if lat is None or lon is None:
                continue

            candidate_coords = (lat, lon)
            distance = self.calculate_distance(query_coords, candidate_coords)

            if distance <= max_distance_km:
                matches.append((candidate, distance))

        # Sort by distance (ascending)
        matches.sort(key=lambda x: x[1])

        return matches

    def geocode_colleges(
        self,
        colleges: List[Dict],
        force_update: bool = False
    ) -> List[Dict]:
        """
        Add geocoding to colleges

        Args:
            colleges: List of college dictionaries
            force_update: Force re-geocode even if coordinates exist

        Returns:
            Updated college list
        """
        from tqdm import tqdm

        updated = []

        for college in tqdm(colleges, desc="Geocoding colleges"):
            # Skip if already geocoded and not forcing update
            if not force_update and college.get('latitude') and college.get('longitude'):
                updated.append(college)
                continue

            # Geocode
            address = college.get('address', '')
            city = college.get('city', '')
            state = college.get('state', '')

            coords = self.geocode_address(address, city, state)

            if coords:
                college['latitude'] = coords[0]
                college['longitude'] = coords[1]
                college['geocoded'] = True
            else:
                college['geocoded'] = False

            updated.append(college)

        return updated

    def hybrid_match_with_distance(
        self,
        query: Dict,
        candidates: List[Dict],
        name_weight: float = 0.7,
        distance_weight: float = 0.3,
        max_distance_km: float = 100.0
    ) -> List[Tuple[Dict, float, str]]:
        """
        Hybrid matching: name similarity + geographic proximity

        Args:
            query: Query record with name and coordinates
            candidates: Candidate colleges
            name_weight: Weight for name similarity
            distance_weight: Weight for distance
            max_distance_km: Maximum distance to consider

        Returns:
            List of (candidate, score, details) tuples
        """
        from rapidfuzz import fuzz

        query_name = query.get('name', '')
        query_coords = (query.get('latitude'), query.get('longitude'))

        if not all(query_coords):
            logger.warning("Query coordinates missing, using name-only matching")
            distance_weight = 0.0
            name_weight = 1.0

        results = []

        for candidate in candidates:
            # Name similarity
            candidate_name = candidate.get('name', '')
            name_score = fuzz.ratio(query_name.upper(), candidate_name.upper()) / 100

            # Distance score
            if all(query_coords):
                candidate_coords = (candidate.get('latitude'), candidate.get('longitude'))

                if all(candidate_coords):
                    distance = self.calculate_distance(query_coords, candidate_coords)

                    if distance > max_distance_km:
                        continue  # Too far, skip

                    # Convert distance to score (0-1, closer is better)
                    distance_score = 1.0 - min(distance / max_distance_km, 1.0)
                else:
                    distance_score = 0.0
                    distance = float('inf')
            else:
                distance_score = 0.0
                distance = float('inf')

            # Combined score
            combined_score = (name_score * name_weight) + (distance_score * distance_weight)

            results.append((
                candidate,
                combined_score,
                f"name:{name_score:.2f},dist:{distance:.1f}km"
            ))

        # Sort by score
        results.sort(key=lambda x: x[1], reverse=True)

        return results


# ============================================================================
# EXCEL ADD-IN SUPPORT
# ============================================================================

class ExcelAddInBridge:
    """Bridge for Excel Add-in integration via COM/API"""

    def __init__(self, api_endpoint: str = 'http://localhost:5000'):
        """
        Initialize Excel Add-in bridge

        Args:
            api_endpoint: Local API endpoint for Add-in communication
        """
        self.api_endpoint = api_endpoint
        self.session_id = None

    def start_session(self) -> str:
        """Start a new matching session"""
        import uuid
        self.session_id = str(uuid.uuid4())
        logger.info(f"Started Excel Add-in session: {self.session_id}")
        return self.session_id

    def match_from_excel(
        self,
        excel_data: List[Dict],
        master_data: List[Dict],
        threshold: float = 0.7
    ) -> List[Dict]:
        """
        Match data from Excel Add-in

        Args:
            excel_data: Data from Excel sheet
            master_data: Master college data
            threshold: Matching threshold

        Returns:
            Matched results
        """
        results = []

        for row in excel_data:
            # Extract fields
            college_name = row.get('College Name', '')
            state = row.get('State', '')

            # Simple matching (use your advanced matcher here)
            best_match = None
            best_score = 0.0

            for master in master_data:
                from rapidfuzz import fuzz
                score = fuzz.ratio(college_name.upper(), master.get('name', '').upper()) / 100

                if score > best_score and score >= threshold:
                    best_score = score
                    best_match = master

            result = row.copy()
            result['matched_college'] = best_match
            result['match_score'] = best_score
            result['match_status'] = 'matched' if best_match else 'unmatched'

            results.append(result)

        return results

    def export_to_json(self, data: List[Dict], output_path: str):
        """Export results to JSON for Excel Add-in"""
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"Exported {len(data)} records to {output_path}")


# Standalone usage examples
if __name__ == "__main__":
    print("Advanced Integrations Module")
    print("=" * 80)

    # Google Sheets example
    print("\n1. Google Sheets Integration")
    print("-" * 80)
    sheets = GoogleSheetsIntegration('credentials.json')
    print("To use: Create credentials in Google Cloud Console")
    print("Enable Google Sheets API and download credentials.json")

    # Geospatial example
    print("\n2. Geospatial Matching")
    print("-" * 80)
    geo = GeospatialMatcher()

    # Example: Geocode AIIMS Delhi
    coords = geo.geocode_address("AIIMS", "New Delhi", "Delhi")
    if coords:
        print(f"AIIMS Delhi coordinates: {coords}")

    # Excel Add-in example
    print("\n3. Excel Add-in Bridge")
    print("-" * 80)
    excel_bridge = ExcelAddInBridge()
    session_id = excel_bridge.start_session()
    print(f"Excel Add-in session started: {session_id}")
