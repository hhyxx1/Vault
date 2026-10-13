#include <array>
#include <cstdint>
#include <iostream>
#include <vector>
using namespace std;

struct Record {
  uint32_t key;
  int tag;
};

int main() {
  int n;
  if (!(cin >> n) || n < 0 || n > 500)
    return 1;
  vector<Record> rows(n), output(n);
  for (Record &row : rows) {
    unsigned long long key;
    if (!(cin >> key >> row.tag) || key > 0xFFFFFFFFULL)
      return 1;
    row.key = static_cast<uint32_t>(key);
  }

  for (int shift = 0; shift < 32; shift += 8) {
    array<size_t, 256> end{};
    for (const Record &row : rows)
      ++end[(row.key >> shift) & 255U];
    size_t prefix = 0;
    for (size_t &count : end) {
      prefix += count;
      count = prefix;
    }
    // Stable placement: consume equal-digit records from right to left.
    for (int i = n - 1; i >= 0; --i) {
      size_t digit = (rows[i].key >> shift) & 255U;
      output[--end[digit]] = rows[i];
    }
    rows.swap(output);
  }

  cout << "{\"records\":[";
  for (int i = 0; i < n; ++i) {
    if (i)
      cout << ',';
    cout << '[' << rows[i].key << ',' << rows[i].tag << ']';
  }
  cout << "]}\n";
}
