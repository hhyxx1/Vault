#include <algorithm>
#include <functional>
#include <iostream>
#include <numeric>
#include <vector>
using namespace std;
struct Edge {
  int u, v, id;
  long long w;
};
int main() {
  int n, m;
  cin >> n >> m;
  vector<Edge> edges(m);
  for (int i = 0; i < m; ++i) {
    auto &e = edges[i];
    cin >> e.u >> e.v >> e.w;
    e.id = i;
  }
  sort(edges.begin(), edges.end(),
       [](const Edge &a, const Edge &b) { return a.w < b.w; });
  vector<int> parent(n);
  iota(parent.begin(), parent.end(), 0);
  function<int(int)> root = [&](int u) {
    return parent[u] == u ? u : parent[u] = root(parent[u]);
  };
  long long cost = 0;
  int components = n;
  vector<int> chosen;
  for (auto &e : edges) {
    int a = root(e.u), b = root(e.v);
    if (a != b) {
      parent[a] = b;
      cost += e.w;
      --components;
      chosen.push_back(e.id);
    }
  }
  cout << "{\"edges\":[";
  for (int i = 0; i < int(chosen.size()); ++i) {
    if (i)
      cout << ',';
    cout << chosen[i];
  }
  cout << "],\"cost\":" << cost << ",\"components\":" << components << "}\n";
}
