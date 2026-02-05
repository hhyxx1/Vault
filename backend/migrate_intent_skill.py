"""Add intent and skill_used columns to qa_records table"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:llmbigmodel@localhost:5432/survey_db"

try:
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Add intent column
        conn.execute(text("""
            ALTER TABLE qa_records 
            ADD COLUMN IF NOT EXISTS intent VARCHAR(50)
        """))
        
        # Add skill_used column
        conn.execute(text("""
            ALTER TABLE qa_records 
            ADD COLUMN IF NOT EXISTS skill_used VARCHAR(200)
        """))
        
        conn.commit()
    
    print("Migration successful! Added intent and skill_used columns")
    
except Exception as e:
    print(f"Migration failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
