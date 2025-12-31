from recent3 import AdvancedSQLiteMatcher

def check_master():
    matcher = AdvancedSQLiteMatcher()
    matcher.load_master_data()
    
    targets = ["GRACE", "KENNETT", "ZOI", "SAI SANJEEVINI", "UDAI OMNI"]
    
    print(f"--- Checking Master Data for {targets} ---")
    
    for stream in ['medical', 'dental', 'dnb']:
        if stream in matcher.master_data:
            for col in matcher.master_data[stream]['colleges']:
                name = col['name'].upper()
                for target in targets:
                    if target in name:
                        print(f"Found '{target}': {name} (ID: {col['id']}, State: {col.get('state', 'N/A')})")

if __name__ == "__main__":
    check_master()
