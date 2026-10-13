#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main() {
  int cap;
  if (!(cin >> cap) || cap < 1 || cap > 1000)
    return 1;
  vector<int> a(cap);
  int n = 0;
  string op;
  while (cin >> op) {
    if (op == "push") {
      int x;
      cin >> x;
      if (n == cap)
        cout << "full\n";
      else {
        a[n++] = x;
        cout << "ok\n";
      }
    } else if (op == "size")
      cout << n << '\n';
    else if (op == "peek" || op == "pop") {
      if (!n)
        cout << "empty\n";
      else {
        cout << a[n - 1] << '\n';
        if (op == "pop")
          --n;
      }
    }
  }
}
