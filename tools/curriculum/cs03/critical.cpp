#include <algorithm>
#include <iostream>
#include <queue>
#include <vector>
using namespace std;
struct Edge {
  int u, v;
  long long w;
};
int main() {
  int n, m;
  cin >> n >> m;
  vector<Edge> edges(m);
  vector<vector<int>> adj(n);
  vector<int> degree(n), order;
  for (int i = 0; i < m; ++i) {
    auto &e = edges[i];
    cin >> e.u >> e.v >> e.w;
    if (e.w < 0) {
      cout << "invalid\n";
      return 0;
    }
    adj[e.u].push_back(i);
    ++degree[e.v];
  }
  queue<int> q;
  for (int i = 0; i < n; ++i)
    if (!degree[i])
      q.push(i);
  while (!q.empty()) {
    int u = q.front();
    q.pop();
    order.push_back(u);
    for (int id : adj[u])
      if (--degree[edges[id].v] == 0)
        q.push(edges[id].v);
  }
  if (int(order.size()) != n) {
    cout << "cycle\n";
    return 0;
  }
  vector<long long> early(n), late(n);
  for (int u : order)
    for (int id : adj[u]) {
      auto &e = edges[id];
      early[e.v] = max(early[e.v], early[u] + e.w);
    }
  fill(late.begin(), late.end(), *max_element(early.begin(), early.end()));
  for (auto it = order.rbegin(); it != order.rend(); ++it)
    for (int id : adj[*it]) {
      auto &e = edges[id];
      late[e.u] = min(late[e.u], late[e.v] - e.w);
    }
  auto print = [&](const char *name, const vector<long long> &row) {
    cout << name << '=';
    for (int i = 0; i < n; ++i) {
      if (i)
        cout << ' ';
      cout << row[i];
    }
    cout << '\n';
  };
  print("early", early);
  print("late", late);
  cout << "critical=";
  bool first = true;
  for (int i = 0; i < m; ++i) {
    auto &e = edges[i];
    if (early[e.u] == late[e.v] - e.w) {
      if (!first)
        cout << ' ';
      first = false;
      cout << i;
    }
  }
  if (first)
    cout << "none";
  cout << '\n';
}
