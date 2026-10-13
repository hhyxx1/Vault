#include <iostream>
#include <utility>
#include <vector>

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);
  int n, maximum;
  if (!(std::cin >> n >> maximum) || n < 0 || maximum < 0) return 1;
  std::vector<std::vector<std::pair<int, int>>> buckets(maximum + 1);
  for (int i = 0; i < n; ++i) {
    int key, tag;
    std::cin >> key >> tag;
    if (key < 0 || key > maximum) return 1;
    buckets[key].push_back({key, tag});
  }
  for (const auto& bucket : buckets)
    for (const auto& [key, tag] : bucket) std::cout << key << ' ' << tag << '\n';
}
