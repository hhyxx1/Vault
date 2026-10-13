#include <algorithm>
#include <iostream>
#include <limits>
#include <vector>
using namespace std;
struct Edge {
  int u, v;
  long long w;
};
int main() {
  int n, m, s;
  cin >> n >> m >> s;
  vector<Edge> edges(m);
  bool negative = false;
  for (auto &e : edges) {
    cin >> e.u >> e.v >> e.w;
    negative = negative || e.w < 0;
  }
  const long long INF = numeric_limits<long long>::max() / 4;
  auto print = [&](const vector<long long> &dist) {
    for (int i = 0; i < n; ++i) {
      if (i)
        cout << ' ';
      if (dist[i] == INF)
        cout << "INF";
      else
        cout << dist[i];
    }
    cout << '\n';
  };
  cout << "dijkstra=";
  if (negative)
    cout << "unsupported-negative\n";
  else {
    vector<long long> dist(n, INF);
    vector<int> seen(n);
    dist[s] = 0;
    for (int round = 0; round < n; ++round) {
      int u = -1;
      for (int i = 0; i < n; ++i)
        if (!seen[i] && (u == -1 || dist[i] < dist[u]))
          u = i;
      if (u == -1 || dist[u] == INF)
        break;
      seen[u] = 1;
      for (auto &e : edges)
        if (e.u == u)
          dist[e.v] = min(dist[e.v], dist[u] + e.w);
    }
    print(dist);
  }
  vector<long long> dist(n, INF);
  dist[s] = 0;
  for (int round = 1; round < n; ++round) {
    bool changed = false;
    for (auto &e : edges)
      if (dist[e.u] != INF && dist[e.v] > dist[e.u] + e.w) {
        dist[e.v] = dist[e.u] + e.w;
        changed = true;
      }
    if (!changed)
      break;
  }
  bool cycle = false;
  for (auto &e : edges)
    if (dist[e.u] != INF && dist[e.v] > dist[e.u] + e.w)
      cycle = true;
  cout << "bellman=";
  if (cycle)
    cout << "negative-cycle\n";
  else
    print(dist);
}
