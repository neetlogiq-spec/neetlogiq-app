
import psycopg2
import yaml

def check_postgres():
    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)
    
    url = config['database']['postgresql_urls']['master_data']
    print(f"Connecting to: {url}")
    
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, address, state FROM medical_colleges WHERE id = 'MED0444'")
    row = cur.fetchone()
    if row:
        print(f"✅ Found in Postgres: {row}")
    else:
        print("❌ NOT FOUND in Postgres")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    try:
        check_postgres()
    except Exception as e:
        print(f"Error: {e}")
