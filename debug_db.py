from sqlalchemy import text, inspect
from app.db.session import engine

def check_tables():
    insp = inspect(engine)
    tables = insp.get_table_names()
    print("Tables in DB:", tables)
    
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT * FROM parsed_metadata LIMIT 0"))
            print("parsed_metadata table exists and is queryable.")
        except Exception as e:
            print("Error querying parsed_metadata:", e)

if __name__ == "__main__":
    check_tables()
