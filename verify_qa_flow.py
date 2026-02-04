
import requests
import os
from pathlib import Path

def test_qa_flow():
    base_url = "http://127.0.0.1:8000/api/student/qa"
    
    # 1. 创建测试文件
    test_file = Path("test_knowledge.txt")
    test_file.write_text("北京是中国的首都。它是一个拥有悠久历史和灿烂文化的城市。", encoding="utf-8")
    
    print("--- 步骤 1: 上传文件 ---")
    try:
        with open(test_file, "rb") as f:
            files = {"file": ("test_knowledge.txt", f, "text/plain")}
            response = requests.post(f"{base_url}/upload", files=files)
            
        if response.status_code == 200:
            result = response.json()
            session_id = result["session_id"]
            print(f"✅ 文件上传成功! Session ID: {session_id}, 块数量: {result['chunk_count']}")
        else:
            print(f"❌ 文件上传失败: {response.text}")
            return

        print("\n--- 步骤 2: 提问 ---")
        question_data = {
            "question": "中国的首都是哪里？",
            "session_id": session_id
        }
        response = requests.post(f"{base_url}/ask", json=question_data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 提问成功!")
            print(f"AI 回答: {result['answer']}")
            print(f"参考出处: {result['sources']}")
        else:
            print(f"❌ 提问失败: {response.text}")

    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        if test_file.exists():
            os.remove(test_file)

if __name__ == "__main__":
    test_qa_flow()
