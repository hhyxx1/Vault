#include <iostream>
#include <vector>
using namespace std;

int main() {
  int capacity;
  if (!(cin >> capacity) || capacity < 1 || capacity > 1000)
    return 1;
  vector<long long> values(capacity);
  int head = 0;
  int size = 0;
  string operation;
  while (cin >> operation) {
    if (operation == "push_front" || operation == "push_back") {
      long long value;
      if (!(cin >> value))
        return 1;
      if (size == capacity) {
        cout << "full\n";
      } else if (operation == "push_front") {
        head = (head + capacity - 1) % capacity;
        values[head] = value;
        ++size;
        cout << "ok\n";
      } else {
        values[(head + size) % capacity] = value;
        ++size;
        cout << "ok\n";
      }
    } else if (operation == "pop_front") {
      if (size == 0) {
        cout << "empty\n";
      } else {
        cout << values[head] << '\n';
        head = (head + 1) % capacity;
        --size;
      }
    } else if (operation == "pop_back") {
      if (size == 0) {
        cout << "empty\n";
      } else {
        cout << values[(head + size - 1) % capacity] << '\n';
        --size;
      }
    } else if (operation == "front" || operation == "back") {
      if (size == 0) {
        cout << "empty\n";
      } else {
        int index = operation == "front" ? head : (head + size - 1) % capacity;
        cout << values[index] << '\n';
      }
    } else if (operation == "size") {
      cout << size << '\n';
    } else {
      return 1;
    }
  }
}
