"""
数据库迁移脚本
执行 migrate_survey_release.sql
"""
import psycopg
from app.config.settings import settings

def run_migration():
    # 从DATABASE_URL提取连接信息
    db_url = settings.DATABASE_URL.replace('postgresql+psycopg://', '')
    
    print("连接数据库...")
    try:
        # 使用psycopg连接数据库
        with psycopg.connect(f"postgresql://{db_url}") as conn:
            with conn.cursor() as cur:
                print("读取迁移脚本...")
                with open('database/migrate_survey_release.sql', 'r', encoding='utf-8') as f:
                    sql = f.read()
                
                print("执行迁移...")
                cur.execute(sql)
                conn.commit()
                
                print("✓ 迁移成功完成!")
                
                # 验证列是否添加成功
                cur.execute("""
                    SELECT column_name, data_type, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = 'surveys' 
                    AND column_name IN ('release_type', 'target_class_ids')
                    ORDER BY column_name;
                """)
                
                columns = cur.fetchall()
                if columns:
                    print("\n新增列验证:")
                    for col in columns:
                        print(f"  - {col[0]}: {col[1]} (默认值: {col[2]})")
                else:
                    print("\n警告: 未找到新增的列")
                    
    except Exception as e:
        print(f"✗ 迁移失败: {e}")
        return False
    
    return True

if __name__ == "__main__":
    run_migration()
