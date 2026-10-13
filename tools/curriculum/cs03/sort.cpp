// Six original sorting implementations. Counters are explanatory telemetry.
#include <functional>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
struct Record {
  long long key;
  int tag;
};
long long comparisons = 0, moves = 0;
bool before(const Record &a, const Record &b) {
  ++comparisons;
  return a.key < b.key;
}
void exchange(Record &a, Record &b) {
  Record t = a;
  a = b;
  b = t;
  moves += 3;
}
void insertion(vector<Record> &a) {
  for (int i = 1; i < int(a.size()); ++i) {
    Record value = a[i];
    int j = i;
    while (j > 0 && before(value, a[j - 1])) {
      a[j] = a[j - 1];
      ++moves;
      --j;
    }
    a[j] = value;
    ++moves;
  }
}
void bubble(vector<Record> &a) {
  for (int i = 0; i < int(a.size()); ++i) {
    bool changed = false;
    for (int j = 1; j < int(a.size()) - i; ++j)
      if (before(a[j], a[j - 1])) {
        exchange(a[j], a[j - 1]);
        changed = true;
      }
    if (!changed)
      break;
  }
}
void selection(vector<Record> &a) {
  for (int i = 0; i < int(a.size()); ++i) {
    int best = i;
    for (int j = i + 1; j < int(a.size()); ++j)
      if (before(a[j], a[best]))
        best = j;
    if (best != i)
      exchange(a[i], a[best]);
  }
}
void mergeSort(vector<Record> &a, int lo, int hi) {
  if (hi - lo < 2)
    return;
  int mid = (lo + hi) / 2;
  mergeSort(a, lo, mid);
  mergeSort(a, mid, hi);
  vector<Record> temp;
  int i = lo, j = mid;
  while (i < mid || j < hi) {
    if (j == hi || (i < mid && !before(a[j], a[i])))
      temp.push_back(a[i++]);
    else
      temp.push_back(a[j++]);
    ++moves;
  }
  for (int k = lo; k < hi; ++k) {
    a[k] = temp[k - lo];
    ++moves;
  }
}
void quick(vector<Record> &a, int lo, int hi) {
  if (lo >= hi)
    return;
  Record pivot = a[(lo + hi) / 2];
  int i = lo, j = hi;
  while (i <= j) {
    while (before(a[i], pivot))
      ++i;
    while (before(pivot, a[j]))
      --j;
    if (i <= j) {
      exchange(a[i], a[j]);
      ++i;
      --j;
    }
  }
  if (lo < j)
    quick(a, lo, j);
  if (i < hi)
    quick(a, i, hi);
}
void heapSort(vector<Record> &a) {
  function<void(int, int)> down = [&](int root, int n) {
    while (true) {
      int best = root, left = 2 * root + 1, right = left + 1;
      if (left < n && before(a[best], a[left]))
        best = left;
      if (right < n && before(a[best], a[right]))
        best = right;
      if (best == root)
        return;
      exchange(a[root], a[best]);
      root = best;
    }
  };
  for (int i = int(a.size()) / 2 - 1; i >= 0; --i)
    down(i, a.size());
  for (int end = int(a.size()) - 1; end > 0; --end) {
    exchange(a[0], a[end]);
    down(0, end);
  }
}
int main() {
  string algorithm;
  int n;
  cin >> algorithm >> n;
  if (n < 0 || n > 200)
    return 1;
  vector<Record> a(n);
  for (auto &row : a)
    cin >> row.key >> row.tag;
  if (algorithm == "insertion")
    insertion(a);
  else if (algorithm == "bubble")
    bubble(a);
  else if (algorithm == "selection")
    selection(a);
  else if (algorithm == "merge")
    mergeSort(a, 0, n);
  else if (algorithm == "quick")
    quick(a, 0, n - 1);
  else if (algorithm == "heap")
    heapSort(a);
  else
    return 1;
  cout << "{\"records\":[";
  for (int i = 0; i < n; ++i) {
    if (i)
      cout << ',';
    cout << '[' << a[i].key << ',' << a[i].tag << ']';
  }
  cout << "],\"comparisons\":" << comparisons << ",\"moves\":" << moves << "}\n";
}
