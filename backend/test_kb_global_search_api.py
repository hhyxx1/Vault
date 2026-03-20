"""最小化回归测试: 教师全局知识库统计与搜索接口。"""
import argparse
import json

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test teacher global knowledge-base APIs")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--username", default="teacher01", help="Teacher username")
    parser.add_argument("--password", default="123456", help="Teacher password")
    parser.add_argument("--query", default="test", help="Search query")
    parser.add_argument("--n-results", type=int, default=5, help="Top N results")
    return parser.parse_args()


def login(base_url: str, username: str, password: str) -> str:
    resp = requests.post(
        f"{base_url}/api/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    print(f"login_status={resp.status_code}")
    resp.raise_for_status()

    token = resp.json().get("access_token")
    if not token:
        raise RuntimeError("登录成功但未返回 access_token")
    return token


def main() -> int:
    args = parse_args()

    try:
        token = login(args.base_url, args.username, args.password)
    except Exception as exc:
        print(f"登录失败: {exc}")
        return 1

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        stats_resp = requests.get(
            f"{args.base_url}/api/teacher/knowledge-base/global/stats",
            headers=headers,
            timeout=20,
        )
        print(f"global_stats_status={stats_resp.status_code}")
        if stats_resp.status_code == 200:
            print("global_stats_body=")
            print(json.dumps(stats_resp.json(), ensure_ascii=False, indent=2))
        else:
            print(f"global_stats_error={stats_resp.text}")

        search_resp = requests.post(
            f"{args.base_url}/api/teacher/knowledge-base/global/search",
            headers=headers,
            json={"query": args.query, "n_results": args.n_results},
            timeout=20,
        )
        print(f"global_search_status={search_resp.status_code}")
        if search_resp.status_code == 200:
            print("global_search_body=")
            print(json.dumps(search_resp.json(), ensure_ascii=False, indent=2))
            return 0

        print(f"global_search_error={search_resp.text}")
        return 1
    except Exception as exc:
        print(f"请求失败: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
