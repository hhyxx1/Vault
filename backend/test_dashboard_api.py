"""测试教师看板API"""
import requests
import json

# 1. 先登录获取token
print("=" * 60)
print("步骤1: 登录teacher账号")
login_url = "http://localhost:8000/api/auth/login"
login_data = {
    "username": "teacher",
    "password": "123456"
}

try:
    login_response = requests.post(login_url, json=login_data)
    print(f"登录状态码: {login_response.status_code}")
    
    if login_response.status_code == 200:
        login_result = login_response.json()
        token = login_result.get('access_token')
        print(f"登录成功!")
        print(f"Token: {token[:50]}...")
        
        # 2. 使用token访问dashboard API
        print("\n" + "=" * 60)
        print("步骤2: 获取教师看板数据")
        dashboard_url = "http://localhost:8000/api/teacher/dashboard/overview"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        dashboard_response = requests.get(dashboard_url, headers=headers)
        print(f"看板API状态码: {dashboard_response.status_code}")
        
        if dashboard_response.status_code == 200:
            data = dashboard_response.json()
            print(f"\n获取成功! 数据如下:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            print(f"错误: {dashboard_response.text}")
    else:
        print(f"登录失败: {login_response.text}")
        
except Exception as e:
    print(f"请求出错: {e}")
    print(f"请确保后端服务在 http://localhost:8000 上运行")
