#include <iostream>
#include <vector>
using namespace std;
int main() {
  int n;
  cin >> n;
  if (n < 0 || n > 100) {
    cout << "invalid\n";
    return 0;
  }
  if (!n) {
    cout << "empty\n";
    return 0;
  }
  vector<int> parent(n), first(n, -1), sibling(n, -1), seen(n);
  vector<vector<int>> child(n);
  int root = -1, roots = 0;
  for (int i = 0; i < n; ++i) {
    cin >> parent[i];
    if (parent[i] < -1 || parent[i] >= n) {
      cout << "invalid\n";
      return 0;
    }
    if (parent[i] == -1) {
      root = i;
      ++roots;
    } else
      child[parent[i]].push_back(i);
  }
  if (roots != 1) {
    cout << "invalid\n";
    return 0;
  }
  vector<int> stack{root};
  int count = 0;
  while (!stack.empty()) {
    int node = stack.back();
    stack.pop_back();
    if (seen[node]) {
      cout << "invalid\n";
      return 0;
    }
    seen[node] = 1;
    ++count;
    for (int x : child[node])
      stack.push_back(x);
  }
  if (count != n) {
    cout << "invalid\n";
    return 0;
  }
  for (int i = 0; i < n; ++i) {
    if (!child[i].empty())
      first[i] = child[i][0];
    for (int j = 1; j < int(child[i].size()); ++j)
      sibling[child[i][j - 1]] = child[i][j];
  }
  cout << "root=" << root << '\n';
  for (int i = 0; i < n; ++i)
    cout << i << ':' << first[i] << ',' << sibling[i] << '\n';
}
