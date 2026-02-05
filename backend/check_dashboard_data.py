"""检查教师看板数据"""
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print('='*60)
print('=== 检查classes表 ===')
classes = db.execute(text('SELECT id, class_name, teacher_id, status FROM classes LIMIT 10')).fetchall()
print(f'班级数量: {len(classes)}')
for c in classes:
    print(f'  班级: {c.class_name}, teacher_id: {c.teacher_id}, status: {c.status}')

print('\n' + '='*60)
print('=== 检查users表(教师) ===')
teachers = db.execute(text("SELECT id, username, role FROM users WHERE role='teacher' LIMIT 10")).fetchall()
print(f'教师数量: {len(teachers)}')
for t in teachers:
    print(f'  教师: {t.username}, id: {t.id}')

print('\n' + '='*60)
print('=== 检查users表(学生) ===')
students = db.execute(text("SELECT id, username, role FROM users WHERE role='student' LIMIT 10")).fetchall()
print(f'学生数量: {len(students)}')
for s in students:
    print(f'  学生: {s.username}, id: {s.id}')

print('\n' + '='*60)
print('=== 检查class_students表 ===')
cs = db.execute(text('SELECT class_id, student_id, status FROM class_students LIMIT 10')).fetchall()
print(f'班级学生关联数量: {len(cs)}')
for c in cs:
    print(f'  class_id: {c.class_id}, student_id: {c.student_id}, status: {c.status}')

print('\n' + '='*60)
print('=== 检查qa_records表 ===')
qa = db.execute(text('SELECT id, student_id, question, created_at FROM qa_records LIMIT 10')).fetchall()
print(f'QA记录数量: {len(qa)}')
for q in qa:
    print(f'  学生ID: {q.student_id}, 问题: {q.question[:30]}..., 时间: {q.created_at}')

print('\n' + '='*60)
print('=== 检查survey_responses表 ===')
sr = db.execute(text('SELECT id, student_id, survey_id, status FROM survey_responses LIMIT 10')).fetchall()
print(f'问卷响应数量: {len(sr)}')
for s in sr:
    print(f'  学生ID: {s.student_id}, 问卷ID: {s.survey_id}, 状态: {s.status}')

# 特别检查：教师ID匹配
if teachers:
    teacher_id = str(teachers[0].id)
    print(f'\n' + '='*60)
    print(f'=== 检查第一个教师({teachers[0].username})的数据 ===')
    
    # 检查该教师的班级
    teacher_classes = db.execute(text("""
        SELECT id, class_name, status 
        FROM classes 
        WHERE teacher_id = :teacher_id
    """), {"teacher_id": teacher_id}).fetchall()
    print(f'该教师的班级数量: {len(teacher_classes)}')
    for tc in teacher_classes:
        print(f'  班级: {tc.class_name}, status: {tc.status}')
        
        # 检查每个班级的学生
        class_students = db.execute(text("""
            SELECT cs.student_id, cs.status, u.username
            FROM class_students cs
            JOIN users u ON cs.student_id = u.id
            WHERE cs.class_id = :class_id
        """), {"class_id": str(tc.id)}).fetchall()
        print(f'    班级学生数: {len(class_students)}')
        for cs in class_students:
            print(f'      学生: {cs.username}, status: {cs.status}')

db.close()
print('\n' + '='*60)
print('检查完成！')
