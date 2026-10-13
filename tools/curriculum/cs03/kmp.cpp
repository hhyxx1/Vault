#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main() {
  string t, p;
  getline(cin, t);
  getline(cin, p);
  vector<int> pi(p.size()), out;
  for (int i = 1; i < int(p.size()); ++i) {
    int j = pi[i - 1];
    while (j > 0 && p[i] != p[j])
      j = pi[j - 1];
    if (p[i] == p[j])
      ++j;
    pi[i] = j;
  }
  if (p.empty()) {
    for (int i = 0; i <= int(t.size()); ++i)
      out.push_back(i);
  } else {
    int j = 0;
    for (int i = 0; i < int(t.size()); ++i) {
      while (j > 0 && t[i] != p[j])
        j = pi[j - 1];
      if (t[i] == p[j])
        ++j;
      if (j == int(p.size())) {
        out.push_back(i - j + 1);
        j = pi[j - 1];
      }
    }
  }
  cout << "pi=";
  if (pi.empty())
    cout << "empty";
  for (int i = 0; i < int(pi.size()); ++i) {
    if (i)
      cout << ' ';
    cout << pi[i];
  }
  cout << "\nmatch=";
  if (out.empty())
    cout << "none";
  for (int i = 0; i < int(out.size()); ++i) {
    if (i)
      cout << ' ';
    cout << out[i];
  }
  cout << '\n';
}
