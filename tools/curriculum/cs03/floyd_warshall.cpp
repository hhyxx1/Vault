#include <iostream>
#include <limits>
#include <vector>

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);
  int n, m;
  if (!(std::cin >> n >> m) || n < 1 || m < 0) return 1;
  constexpr long long INF = std::numeric_limits<long long>::max() / 4;
  std::vector<std::vector<long long>> distance(n, std::vector<long long>(n, INF));
  for (int i = 0; i < n; ++i) distance[i][i] = 0;
  for (int i = 0; i < m; ++i) {
    int from, to;
    long long weight;
    std::cin >> from >> to >> weight;
    if (from < 0 || from >= n || to < 0 || to >= n) return 1;
    if (weight < distance[from][to]) distance[from][to] = weight;
  }

  for (int k = 0; k < n; ++k) {
    for (int i = 0; i < n; ++i) {
      if (distance[i][k] == INF) continue;
      for (int j = 0; j < n; ++j) {
        if (distance[k][j] == INF) continue;
        const long long through = distance[i][k] + distance[k][j];
        if (through < distance[i][j]) distance[i][j] = through;
      }
    }
  }

  for (int i = 0; i < n; ++i) {
    if (distance[i][i] < 0) {
      std::cout << "negative-cycle\n";
      return 0;
    }
  }
  for (const auto& row : distance) {
    for (int j = 0; j < n; ++j) {
      if (j) std::cout << ' ';
      if (row[j] == INF) std::cout << "INF";
      else std::cout << row[j];
    }
    std::cout << '\n';
  }
}
