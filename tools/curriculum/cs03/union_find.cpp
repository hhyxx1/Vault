#include <iostream>
#include <numeric>
#include <vector>
using namespace std;

struct DisjointSet {
  vector<int> parent, weight;
  int components;

  explicit DisjointSet(int n) : parent(n), weight(n, 1), components(n) {
    iota(parent.begin(), parent.end(), 0);
  }

  int find(int x) {
    if (parent[x] == x)
      return x;
    int root = find(parent[x]);
    parent[x] = root;
    return root;
  }

  bool unite(int a, int b) {
    a = find(a);
    b = find(b);
    if (a == b)
      return false;
    if (weight[a] < weight[b] || (weight[a] == weight[b] && a > b))
      swap(a, b);
    parent[b] = a;
    weight[a] += weight[b];
    --components;
    return true;
  }

  int setSize(int x) { return weight[find(x)]; }

  int pathDepth(int x) {
    int depth = 0;
    for (int current = x; parent[current] != current; current = parent[current])
      ++depth;
    find(x);
    return depth;
  }

  bool valid() {
    vector<int> observed(parent.size(), 0);
    int roots = 0;
    for (int i = 0; i < int(parent.size()); ++i) {
      int root = find(i);
      ++observed[root];
      roots += root == i;
    }
    if (roots != components)
      return false;
    for (int i = 0; i < int(parent.size()); ++i)
      if (parent[i] == i && observed[i] != weight[i])
        return false;
    return true;
  }
};

int main() {
  int n;
  if (!(cin >> n) || n < 1 || n > 200)
    return 1;
  DisjointSet sets(n);
  char operation;
  while (cin >> operation) {
    if (operation == 'U') {
      int a, b;
      cin >> a >> b;
      cout << (sets.unite(a, b) ? "merged" : "same") << '\n';
    } else if (operation == 'C') {
      int a, b;
      cin >> a >> b;
      cout << (sets.find(a) == sets.find(b) ? 1 : 0) << '\n';
    } else if (operation == 'S') {
      int a;
      cin >> a;
      cout << sets.setSize(a) << '\n';
    } else if (operation == 'N') {
      cout << sets.components << '\n';
    } else if (operation == 'P') {
      int a;
      cin >> a;
      cout << sets.pathDepth(a) << '\n';
    } else if (operation == 'V') {
      cout << (sets.valid() ? "valid" : "corrupt") << '\n';
    } else {
      return 1;
    }
  }
}
