#include <algorithm>
#include <iostream>
#include <set>
#include <vector>
using namespace std;

int main() {
  int capacity;
  if (!(cin >> capacity) || capacity < 1 || capacity > 1000)
    return 1;
  vector<vector<long long>> buckets(capacity);
  int size = 0;
  auto bucketOf = [capacity](long long key) {
    return static_cast<int>((key % capacity + capacity) % capacity);
  };
  auto contains = [&buckets](int bucket, long long key) {
    return find(buckets[bucket].begin(), buckets[bucket].end(), key) != buckets[bucket].end();
  };

  string operation;
  while (cin >> operation) {
    if (operation == "P") {
      vector<long long> keys;
      for (const auto &bucket : buckets)
        keys.insert(keys.end(), bucket.begin(), bucket.end());
      sort(keys.begin(), keys.end());
      if (keys.empty()) {
        cout << "empty\n";
      } else {
        for (int i = 0; i < static_cast<int>(keys.size()); ++i)
          cout << (i ? " " : "") << keys[i];
        cout << '\n';
      }
    } else if (operation == "C") {
      int maxChain = 0;
      for (const auto &bucket : buckets)
        maxChain = max(maxChain, static_cast<int>(bucket.size()));
      cout << "size=" << size << " max_chain=" << maxChain << '\n';
    } else if (operation == "V") {
      set<long long> seen;
      bool valid = true;
      int count = 0;
      for (int i = 0; i < capacity; ++i) {
        for (long long key : buckets[i]) {
          ++count;
          if (bucketOf(key) != i || !seen.insert(key).second)
            valid = false;
        }
      }
      cout << (valid && count == size ? "valid" : "corrupt") << '\n';
    } else if (operation == "I" || operation == "D" || operation == "F") {
      long long key;
      if (!(cin >> key))
        return 1;
      int index = bucketOf(key);
      auto &bucket = buckets[index];
      auto position = find(bucket.begin(), bucket.end(), key);
      bool found = position != bucket.end();
      if (operation == "I") {
        if (found) {
          cout << "exists\n";
        } else {
          bucket.push_back(key);
          ++size;
          cout << "inserted\n";
        }
      } else if (operation == "D") {
        if (found) {
          bucket.erase(position);
          --size;
          cout << "deleted\n";
        } else {
          cout << "missing\n";
        }
      } else {
        cout << (found ? "found" : "missing") << '\n';
      }
    } else {
      return 1;
    }
  }
}
