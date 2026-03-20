"""Add intent and skill_used columns to qa_records table"""
import sys
import os
import locale

# Force UTF-8 encoding
try:
    locale.setlocale(locale.LC_ALL, 'C.UTF-8')
except:
    try:
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    except:
        pass

os.environ['PGCLIENTENCODING'] = 'UTF8'
os.environ['PYTHONUTF8'] = '1'

sys.path.insert(0, os.path.dirname(__file__))

async def run_migration():
    try:
        from app.database import engine
        from sqlalchemy import text
        
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
        
        print("[SUCCESS] Migration completed! Added intent and skill_used columns to qa_records table")
        return True
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import asyncio
    result = asyncio.run(run_migration())
    sys.exit(0 if result else 1)
