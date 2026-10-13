#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main() {
  string t, p;
  getline(cin, t);
  getline(cin, p);
  int n = t.size(), m = p.size();
  vector<int> out;
  for (int i = 0; i <= n - m; ++i) {
    int j = 0;
    while (j < m && t[i + j] == p[j])
      ++j;
    if (j == m)
      out.push_back(i);
  }
  if (out.empty())
    cout << "none";
  for (int i = 0; i < int(out.size()); ++i) {
    if (i)
      cout << ' ';
    cout << out[i];
  }
  cout << '\n';
}
