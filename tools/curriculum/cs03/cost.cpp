// Count declared elementary operations on actual arrays and singly linked nodes.
#include <iostream>
#include <vector>
using namespace std;
struct Node {
  long long value;
  Node *next;
};
int main() {
  long long n, i;
  while (cin >> n >> i) {
    if (n < 0 || n > 1000 || i < 0 || i > n) {
      cout << "invalid\n";
      continue;
    }
    vector<long long> a(n + 1);
    Node *head = nullptr;
    for (long long j = n; j > 0; --j) {
      a[j - 1] = j - 1;
      head = new Node{j - 1, head};
    }
    cout << "get=";
    if (i == n)
      cout << "invalid";
    else {
      long long visits = 0;
      Node *p = head;
      for (long long j = 0; j <= i; ++j) {
        ++visits;
        p = p->next;
      }
      volatile long long value = a[i];
      (void)value;
      cout << 1 << ',' << visits;
    }
    long long insertion = 0;
    vector<long long> inserted = a;
    for (long long j = n; j > i; --j) {
      inserted[j] = inserted[j - 1];
      ++insertion;
    }
    cout << " insert=" << insertion << " delete=";
    if (i == n)
      cout << "invalid";
    else {
      long long moves = 0;
      for (long long j = i; j < n - 1; ++j) {
        a[j] = a[j + 1];
        ++moves;
      }
      cout << moves;
    }
    cout << '\n';
    while (head) {
      Node *p = head;
      head = head->next;
      delete p;
    }
  }
}
