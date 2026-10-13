#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
struct Table {
  int cap, n = 0;
  long long probes = 0;
  vector<int> state;
  vector<long long> keys;
  explicit Table(int c) : cap(c), state(c), keys(c) {}
  int index(long long key) const { return int((key % cap + cap) % cap); }
  pair<bool, int> locate(long long key, bool count = true) {
    int tomb = -1;
    for (int step = 0; step < cap; ++step) {
      int i = (index(key) + step) % cap;
      if (count)
        ++probes;
      if (state[i] == 0)
        return {false, tomb >= 0 ? tomb : i};
      if (state[i] == 2) {
        if (tomb < 0)
          tomb = i;
      } else if (keys[i] == key)
        return {true, i};
    }
    return {false, tomb};
  }
  string insert(long long key) {
    auto p = locate(key);
    if (p.first)
      return "exists";
    if (p.second < 0)
      return "full";
    state[p.second] = 1;
    keys[p.second] = key;
    ++n;
    return "inserted";
  }
  vector<long long> all() const {
    vector<long long> out;
    for (int i = 0; i < cap; ++i)
      if (state[i] == 1)
        out.push_back(keys[i]);
    sort(out.begin(), out.end());
    return out;
  }
  string erase(long long key) {
    auto p = locate(key);
    if (!p.first)
      return "missing";
    state[p.second] = 2;
    --n;
    return "deleted";
  }
  string rehash(int capacity) {
    if (capacity < 1 || capacity < n)
      return "invalid";
    auto saved = all();
    cap = capacity;
    state.assign(cap, 0);
    keys.assign(cap, 0);
    n = 0;
    for (long long key : saved)
      insert(key);
    return "rehash";
  }
  bool valid() {
    if (n < 0 || n > cap || int(all().size()) != n)
      return false;
    auto values = all();
    if (adjacent_find(values.begin(), values.end()) != values.end())
      return false;
    for (long long key : values)
      if (!locate(key, false).first)
        return false;
    return true;
  }
};
int main() {
  int cap;
  cin >> cap;
  if (cap < 1 || cap > 1000)
    return 1;
  Table table(cap);
  string op;
  while (cin >> op) {
    if (op == "P") {
      auto values = table.all();
      if (values.empty())
        cout << "empty";
      for (int i = 0; i < int(values.size()); ++i) {
        if (i)
          cout << ' ';
        cout << values[i];
      }
      cout << '\n';
    } else if (op == "C")
      cout << "size=" << table.n << " capacity=" << table.cap
           << " probes=" << table.probes << '\n';
    else if (op == "V")
      cout << (table.valid() ? "valid" : "corrupt") << '\n';
    else {
      long long key;
      cin >> key;
      if (op == "I")
        cout << table.insert(key) << '\n';
      else if (op == "D")
        cout << table.erase(key) << '\n';
      else if (op == "F")
        cout << (table.locate(key).first ? "found" : "missing") << '\n';
      else if (op == "R")
        cout << table.rehash(key) << '\n';
    }
  }
}
