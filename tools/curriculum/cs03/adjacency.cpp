#include <iostream>
#include <set>
#include <vector>
using namespace std;
int main() {
  int n, m, d, s;
  cin >> n >> m >> d >> s;
  vector<set<int>> adj(n);
  for (int i = 0; i < m; ++i) {
    int u, v;
    cin >> u >> v;
    adj[u].insert(v);
    if (!d)
      adj[v].insert(u);
  }
  for (int i = 0; i < n; ++i) {
    cout << i << ':';
    if (adj[i].empty())
      cout << "empty";
    bool first = true;
    for (int v : adj[i]) {
      if (!first)
        cout << ' ';
      first = false;
      cout << v;
    }
    cout << '\n';
  }
  cout << "matrix\n";
  for (int i = 0; i < n; ++i) {
    for (int j = 0; j < n; ++j) {
      if (j)
        cout << ' ';
      cout << adj[i].count(j);
    }
    cout << '\n';
  }
}
