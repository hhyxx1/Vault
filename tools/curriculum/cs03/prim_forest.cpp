#include <iostream>
#include <queue>
#include <tuple>
#include <vector>

struct Edge {
  int from;
  int to;
  long long weight;
};

struct Candidate {
  long long weight;
  int edge;
  int from;
  int to;
  bool operator>(const Candidate& other) const {
    return std::tie(weight, edge, from, to) >
           std::tie(other.weight, other.edge, other.from, other.to);
  }
  bool operator<(const Candidate& other) const {
    return std::tie(weight, edge, from, to) <
           std::tie(other.weight, other.edge, other.from, other.to);
  }
};

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);
  int n, m;
  if (!(std::cin >> n >> m) || n < 1 || m < 0) return 1;
  std::vector<Edge> edges(m);
  std::vector<std::vector<int>> adjacent(n);
  for (int i = 0; i < m; ++i) {
    std::cin >> edges[i].from >> edges[i].to >> edges[i].weight;
    if (edges[i].from < 0 || edges[i].from >= n || edges[i].to < 0 || edges[i].to >= n) return 1;
    adjacent[edges[i].from].push_back(i);
    adjacent[edges[i].to].push_back(i);
  }

  std::vector<bool> visited(n, false);
  std::vector<int> chosen;
  long long cost = 0;
  int components = 0;
  for (int root = 0; root < n; ++root) {
    if (visited[root]) continue;
    ++components;
    visited[root] = true;
    std::priority_queue<Candidate, std::vector<Candidate>, std::greater<Candidate>> frontier;
    auto addFrontier = [&](int vertex) {
      for (int edgeId : adjacent[vertex]) {
        const Edge& edge = edges[edgeId];
        const int next = edge.from == vertex ? edge.to : edge.from;
        if (next != vertex && !visited[next])
          frontier.push({edge.weight, edgeId, vertex, next});
      }
    };
    addFrontier(root);
    while (!frontier.empty()) {
      const Candidate candidate = frontier.top();
      frontier.pop();
      if (visited[candidate.to]) continue;
      visited[candidate.to] = true;
      chosen.push_back(candidate.edge);
      cost += candidate.weight;
      addFrontier(candidate.to);
    }
  }
  std::cout << "{\"edges\":[";
  for (std::size_t i = 0; i < chosen.size(); ++i) {
    if (i) std::cout << ',';
    std::cout << chosen[i];
  }
  std::cout << "],\"cost\":" << cost << ",\"components\":" << components << "}\n";
}
