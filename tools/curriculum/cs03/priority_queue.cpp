#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

vector<long long> heap;

bool higherPriority(long long a, long long b) { return a < b; }

void siftUp(int child) {
  while (child > 0) {
    int parent = (child - 1) / 2;
    if (!higherPriority(heap[child], heap[parent]))
      break;
    swap(heap[child], heap[parent]);
    child = parent;
  }
}

void siftDown(int parent) {
  int n = static_cast<int>(heap.size());
  while (true) {
    int best = parent;
    int left = parent * 2 + 1;
    int right = left + 1;
    if (left < n && higherPriority(heap[left], heap[best]))
      best = left;
    if (right < n && higherPriority(heap[right], heap[best]))
      best = right;
    if (best == parent)
      break;
    swap(heap[parent], heap[best]);
    parent = best;
  }
}

int main() {
  string operation;
  while (cin >> operation) {
    if (operation == "push") {
      long long value;
      if (!(cin >> value))
        return 1;
      heap.push_back(value);
      siftUp(static_cast<int>(heap.size()) - 1);
      cout << "ok\n";
    } else if (operation == "top") {
      if (heap.empty())
        cout << "empty\n";
      else
        cout << heap.front() << '\n';
    } else if (operation == "pop") {
      if (heap.empty()) {
        cout << "empty\n";
      } else {
        cout << heap.front() << '\n';
        if (heap.size() == 1) {
          heap.pop_back();
        } else {
          heap.front() = heap.back();
          heap.pop_back();
          siftDown(0);
        }
      }
    } else if (operation == "size") {
      cout << heap.size() << '\n';
    } else {
      return 1;
    }
  }
}
