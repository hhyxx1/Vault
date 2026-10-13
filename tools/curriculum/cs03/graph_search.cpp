#include <functional>
#include <iostream>
#include <queue>
#include <set>
#include <vector>
using namespace std;
int main() {
  int n, m, d, s;
  cin >> n >> m >> d >> s;
  vector<set<int>> adj(n);
  for (int i = 0; i < m; ++i) {
    int u, v;
    cin >> u >> v;
    adj[u].insert(v);
    if (!d)
      adj[v].insert(u);
  }
  vector<int> distance(n, -1), bfs, dfs, seen(n);
  queue<int> q;
  q.push(s);
  distance[s] = 0;
  while (!q.empty()) {
    int u = q.front();
    q.pop();
    bfs.push_back(u);
    for (int v : adj[u])
      if (distance[v] == -1) {
        distance[v] = distance[u] + 1;
        q.push(v);
      }
  }
  function<void(int)> visit = [&](int u) {
    if (seen[u])
      return;
    seen[u] = 1;
    dfs.push_back(u);
    for (int v : adj[u])
      visit(v);
  };
  visit(s);
  for (int i = 0; i < n; ++i)
    visit(i);
  auto print = [&](const char *name, const vector<int> &v) {
    cout << name << '=';
    for (int i = 0; i < int(v.size()); ++i) {
      if (i)
        cout << ' ';
      cout << v[i];
    }
    cout << '\n';
  };
  print("bfs", bfs);
  print("dfs", dfs);
  print("distance", distance);
}
