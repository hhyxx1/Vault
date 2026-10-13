// FIFO implemented independently as a circular buffer and a linked queue.
#include <iostream>
#include <string>
#include <vector>
using namespace std;
struct Node {
  int x;
  Node *next;
};
int main() {
  int cap;
  if (!(cin >> cap) || cap < 1 || cap > 1000)
    return 1;
  vector<int> a(cap);
  int head = 0, tail = 0, n = 0;
  Node *first = nullptr;
  Node *last = nullptr;
  string op;
  while (cin >> op) {
    if (op == "push") {
      int x;
      cin >> x;
      if (n == cap) {
        cout << "full\n";
        continue;
      }
      a[tail] = x;
      tail = (tail + 1) % cap;
      Node *p = new Node{x, nullptr};
      if (last)
        last->next = p;
      else
        first = p;
      last = p;
      ++n;
      cout << "ok\n";
    } else if (op == "size")
      cout << n << '\n';
    else if (op == "peek" || op == "pop") {
      if (!n) {
        cout << "empty\n";
        continue;
      }
      if (!first || a[head] != first->x) {
        cout << "representation-mismatch\n";
        break;
      }
      cout << a[head] << '\n';
      if (op == "pop") {
        head = (head + 1) % cap;
        Node *p = first;
        first = first->next;
        delete p;
        if (!first)
          last = nullptr;
        --n;
      }
    }
  }
  while (first) {
    Node *p = first;
    first = first->next;
    delete p;
  }
}
