"""
修复问卷数据迁移问题
将旧的 class_id 迁移到 target_class_ids
"""
import psycopg
from app.config.settings import settings
import json

def fix_survey_migration():
    db_url = settings.DATABASE_URL.replace('postgresql+psycopg://', '')
    
    print("=" * 70)
    print("修复问卷数据迁移")
    print("=" * 70)
    
    with psycopg.connect(f"postgresql://{db_url}") as conn:
        with conn.cursor() as cur:
            # 1. 查找有class_id但target_class_ids为空的问卷
            cur.execute("""
                SELECT id, title, class_id, target_class_ids
                FROM surveys
                WHERE class_id IS NOT NULL 
                  AND (target_class_ids IS NULL OR target_class_ids::text = 'null');
            """)
            surveys_to_fix = cur.fetchall()
            
            print(f"\n找到需要修复的问卷数: {len(surveys_to_fix)}")
            
            fixed_count = 0
            for s in surveys_to_fix:
                survey_id, title, class_id, _ = s
                print(f"\n修复问卷: {title}")
                print(f"  ID: {survey_id}")
                print(f"  旧class_id: {class_id}")
                
                # 将class_id迁移到target_class_ids
                cur.execute("""
                    UPDATE surveys
                    SET target_class_ids = jsonb_build_array(%s::text)
                    WHERE id = %s;
                """, (str(class_id), str(survey_id)))
                
                fixed_count += 1
                print(f"  ✓ 已设置target_class_ids = ['{class_id}']")
            
            if fixed_count > 0:
                conn.commit()
                print(f"\n✓ 成功修复 {fixed_count} 个问卷")
            else:
                print("\n没有需要修复的问卷（所有问卷的target_class_ids都已设置）")
            
            # 2. 显示修复后的结果
            print("\n" + "=" * 70)
            print("修复后的问卷状态:")
            print("=" * 70)
            cur.execute("""
                SELECT id, title, status, class_id, target_class_ids, release_type
                FROM surveys
                WHERE status = 'published'
                ORDER BY published_at DESC;
            """)
            
            published_surveys = cur.fetchall()
            for s in published_surveys:
                print(f"\n问卷: {s[1]}")
                print(f"  状态: {s[2]}")
                print(f"  旧class_id: {s[3]}")
                print(f"  新target_class_ids: {s[4]}")
                print(f"  发布类型: {s[5]}")

if __name__ == "__main__":
    fix_survey_migration()
