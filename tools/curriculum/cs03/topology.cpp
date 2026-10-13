#include <iostream>
#include <queue>
#include <vector>
using namespace std;
int main() {
  int n, m;
  cin >> n >> m;
  vector<vector<int>> adj(n);
  vector<int> degree(n), order;
  for (int i = 0; i < m; ++i) {
    int u, v;
    cin >> u >> v;
    adj[u].push_back(v);
    ++degree[v];
  }
  queue<int> q;
  for (int i = 0; i < n; ++i)
    if (!degree[i])
      q.push(i);
  while (!q.empty()) {
    int u = q.front();
    q.pop();
    order.push_back(u);
    for (int v : adj[u])
      if (--degree[v] == 0)
        q.push(v);
  }
  bool cycle = int(order.size()) != n;
  if (cycle)
    order.clear();
  cout << "{\"order\":[";
  for (int i = 0; i < int(order.size()); ++i) {
    if (i)
      cout << ',';
    cout << order[i];
  }
  cout << "],\"cycle\":" << (cycle ? "true" : "false") << "}\n";
}
