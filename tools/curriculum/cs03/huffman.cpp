#include <functional>
#include <iostream>
#include <queue>
#include <string>
#include <vector>
using namespace std;
struct Node {
  long long weight;
  int symbol, left, right;
};
int main() {
  int n;
  if (!(cin >> n) || n < 0 || n > 32)
    return 1;
  vector<Node> tree;
  priority_queue<pair<long long, int>, vector<pair<long long, int>>,
                 greater<pair<long long, int>>>
      q;
  for (int i = 0; i < n; ++i) {
    long long w;
    cin >> w;
    tree.push_back({w, i, -1, -1});
    q.push({w, i});
  }
  while (q.size() > 1) {
    auto a = q.top();
    q.pop();
    auto b = q.top();
    q.pop();
    int id = tree.size();
    tree.push_back({a.first + b.first, -1, a.second, b.second});
    q.push({a.first + b.first, id});
  }
  vector<string> codes(n);
  function<void(int, string)> visit = [&](int id, string code) {
    if (tree[id].symbol >= 0) {
      codes[tree[id].symbol] = code.empty() ? "0" : code;
      return;
    }
    visit(tree[id].left, code + "0");
    visit(tree[id].right, code + "1");
  };
  if (n)
    visit(q.top().second, "");
  int m;
  cin >> m;
  string bits;
  for (int i = 0; i < m; ++i) {
    int symbol;
    cin >> symbol;
    if (symbol < 0 || symbol >= n)
      return 1;
    bits += codes[symbol];
  }
  // Decode from the tree and check the round trip before emitting the artifact.
  if (n > 1) {
    int id = q.top().second;
    vector<int> decoded;
    for (char bit : bits) {
      id = bit == '0' ? tree[id].left : tree[id].right;
      if (tree[id].symbol >= 0) {
        decoded.push_back(tree[id].symbol);
        id = q.top().second;
      }
    }
    if (id != q.top().second || int(decoded.size()) != m)
      return 1;
  }
  cout << "{\"codes\":[";
  for (int i = 0; i < n; ++i) {
    if (i)
      cout << ',';
    cout << '"' << codes[i] << '"';
  }
  cout << "],\"bits\":\"" << bits << "\"}\n";
}
