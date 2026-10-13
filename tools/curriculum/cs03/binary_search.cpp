#include <iostream>
#include <vector>

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);

  int n, q;
  if (!(std::cin >> n >> q) || n < 0 || q < 0) return 1;
  std::vector<int> values(n);
  for (int& value : values) std::cin >> value;

  for (int query = 0; query < q; ++query) {
    int target;
    std::cin >> target;
    int low = 0;
    int high = n;  // Half-open interval [low, high).
    while (low < high) {
      const int middle = low + (high - low) / 2;
      if (values[middle] < target) low = middle + 1;
      else high = middle;
    }
    std::cout << (low < n && values[low] == target ? low : -1) << '\n';
  }
}
