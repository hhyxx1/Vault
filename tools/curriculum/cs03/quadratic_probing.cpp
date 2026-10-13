#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

class QuadraticTable {
 public:
  static constexpr int kCapacity = 11;  // Prime table size.

  QuadraticTable() : slots_(kCapacity), states_(kCapacity, State::Empty) {}

  std::string insert(int key) {
    const auto [found, slot] = locate(key, true);
    if (found) return "exists";
    if (slot < 0) return "full";
    slots_[slot] = key;
    states_[slot] = State::Occupied;
    ++size_;
    return "inserted";
  }

  std::string find(int key) const {
    return locate(key, false).first ? "found" : "missing";
  }

  std::string erase(int key) {
    const auto [found, slot] = locate(key, false);
    if (!found) return "missing";
    states_[slot] = State::Tombstone;
    --size_;
    return "deleted";
  }

  std::string print() const {
    std::vector<int> keys;
    for (int i = 0; i < kCapacity; ++i)
      if (states_[i] == State::Occupied) keys.push_back(slots_[i]);
    std::sort(keys.begin(), keys.end());
    if (keys.empty()) return "empty";
    std::string result;
    for (int i = 0; i < static_cast<int>(keys.size()); ++i) {
      if (i) result += ' ';
      result += std::to_string(keys[i]);
    }
    return result;
  }

  bool valid() const {
    int counted = 0;
    for (int i = 0; i < kCapacity; ++i)
      counted += states_[i] == State::Occupied;
    if (counted != size_) return false;
    for (int i = 0; i < kCapacity; ++i) {
      if (states_[i] == State::Occupied) {
        const auto [found, slot] = locate(slots_[i], false);
        if (!found || slot != i) return false;
      }
    }
    return true;
  }

 private:
  enum class State { Empty, Occupied, Tombstone };
  std::vector<int> slots_;
  std::vector<State> states_;
  int size_ = 0;

  std::pair<bool, int> locate(int key, bool inserting) const {
    int firstTombstone = -1;
    const int home = ((key % kCapacity) + kCapacity) % kCapacity;
    for (int step = 0; step < kCapacity; ++step) {
      const int slot = (home + step * step) % kCapacity;
      if (states_[slot] == State::Empty)
        return {false, firstTombstone >= 0 ? firstTombstone : slot};
      if (states_[slot] == State::Tombstone) {
        if (firstTombstone < 0) firstTombstone = slot;
      } else if (slots_[slot] == key) {
        return {true, slot};
      }
    }
    return {false, inserting ? firstTombstone : -1};
  }
};

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);
  QuadraticTable table;
  std::string operation;
  while (std::cin >> operation) {
    if (operation == "P") std::cout << table.print() << '\n';
    else if (operation == "V") std::cout << (table.valid() ? "valid" : "invalid") << '\n';
    else {
      int key;
      if (!(std::cin >> key)) return 1;
      if (operation == "I") std::cout << table.insert(key) << '\n';
      else if (operation == "F") std::cout << table.find(key) << '\n';
      else if (operation == "D") std::cout << table.erase(key) << '\n';
      else return 1;
    }
  }
}
