import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import SessionLocal
from app.models.survey import Question
from sqlalchemy import text

db = SessionLocal()
rows = db.execute(text("""
    SELECT DISTINCT correct_answer::text as ca, jsonb_typeof(correct_answer) as jtype, question_type
    FROM questions 
    WHERE question_type IN ('choice','judge')
    ORDER BY question_type, ca
""")).fetchall()
for r in rows:
    print(f"{r.question_type:10s} | jtype={r.jtype:8s} | ca={r.ca}")
db.close()
