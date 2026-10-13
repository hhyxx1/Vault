// Original teaching implementation: fixed-capacity sequence, zero-based positions.
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
using namespace std;
class ArrayList {
  vector<int> a;
  int n = 0;

public:
  explicit ArrayList(int cap) : a(cap) {}
  int size() const { return n; }
  int get(int i) const { return a[i]; }
  void set(int i, int x) { a[i] = x; }
  void insert(int i, int x) {
    for (int j = n; j > i; --j)
      a[j] = a[j - 1];
    a[i] = x;
    ++n;
  }
  int erase(int i) {
    int x = a[i];
    for (int j = i; j < n - 1; ++j)
      a[j] = a[j + 1];
    --n;
    return x;
  }
  bool valid() const { return n >= 0 && n <= int(a.size()); }
};
class SinglyList {
  struct Node {
    int x;
    Node *next;
  };
  Node *head = nullptr;
  int n = 0;
  Node *at(int i) const {
    Node *p = head;
    while (i--)
      p = p->next;
    return p;
  }

public:
  ~SinglyList() {
    while (head) {
      Node *p = head;
      head = head->next;
      delete p;
    }
  }
  int size() const { return n; }
  int get(int i) const { return at(i)->x; }
  void set(int i, int x) { at(i)->x = x; }
  void insert(int i, int x) {
    if (i == 0)
      head = new Node{x, head};
    else {
      Node *p = at(i - 1);
      p->next = new Node{x, p->next};
    }
    ++n;
  }
  int erase(int i) {
    Node *p;
    if (i == 0) {
      p = head;
      head = head->next;
    } else {
      Node *prev = at(i - 1);
      p = prev->next;
      prev->next = p->next;
    }
    int x = p->x;
    delete p;
    --n;
    return x;
  }
  bool valid() const {
    int count = 0;
    for (Node *p = head; p; p = p->next) {
      if (++count > n)
        return false;
    }
    return count == n;
  }
};
class CircularList {
  struct Node {
    int x;
    Node *prev;
    Node *next;
  };
  Node root{0, nullptr, nullptr};
  int n = 0;
  Node *at(int i) const {
    Node *p = root.next;
    while (i--)
      p = p->next;
    return p;
  }

public:
  CircularList() { root.prev = root.next = &root; }
  ~CircularList() {
    while (n)
      erase(0);
  }
  int size() const { return n; }
  int get(int i) const { return at(i)->x; }
  void set(int i, int x) { at(i)->x = x; }
  void insert(int i, int x) {
    Node *next = i == n ? &root : at(i);
    Node *p = new Node{x, next->prev, next};
    next->prev->next = p;
    next->prev = p;
    ++n;
  }
  int erase(int i) {
    Node *p = at(i);
    p->prev->next = p->next;
    p->next->prev = p->prev;
    int x = p->x;
    delete p;
    --n;
    return x;
  }
  bool valid() const {
    int count = 0;
    for (Node *p = root.next; p != &root; p = p->next) {
      if (++count > n || p->next->prev != p || p->prev->next != p)
        return false;
    }
    return count == n && root.next->prev == &root && root.prev->next == &root;
  }
};
template <class List> void run(List &a, int cap) {
  string op;
  while (cin >> op) {
    int i, x;
    if (op == "I") {
      cin >> i >> x;
      if (i < 0 || i > a.size())
        cout << "invalid\n";
      else if (a.size() == cap)
        cout << "full\n";
      else {
        a.insert(i, x);
        cout << "ok\n";
      }
    } else if (op == "D" || op == "G" || op == "S") {
      cin >> i;
      if (op == "S")
        cin >> x;
      if (i < 0 || i >= a.size()) {
        cout << "invalid\n";
        continue;
      }
      if (op == "D")
        cout << a.erase(i) << '\n';
      else if (op == "G")
        cout << a.get(i) << '\n';
      else {
        a.set(i, x);
        cout << "ok\n";
      }
    } else if (op == "V")
      cout << (a.valid() ? "valid" : "corrupt") << '\n';
    else if (op == "P" || op == "R") {
      if (!a.size())
        cout << "empty";
      for (int j = 0; j < a.size(); ++j) {
        if (j)
          cout << ' ';
        cout << a.get(op == "P" ? j : a.size() - 1 - j);
      }
      cout << '\n';
    }
  }
}
int main() {
  int cap;
  if (!(cin >> cap) || cap < 1 || cap > 1000)
    return 1;
#if REPRESENTATION == 1
  SinglyList a;
#elif REPRESENTATION == 2
  CircularList a;
#elif REPRESENTATION == 3
  // Replay the same transcript on two independent representations.
  string body((istreambuf_iterator<char>(cin)), {});
  ostringstream left, right;
  auto *originalOut = cout.rdbuf();
  auto *originalIn = cin.rdbuf();
  ArrayList a(cap);
  SinglyList b;
  istringstream in1(body), in2(body);
  cin.rdbuf(in1.rdbuf());
  cout.rdbuf(left.rdbuf());
  run(a, cap);
  cin.clear();
  cin.rdbuf(in2.rdbuf());
  cout.rdbuf(right.rdbuf());
  run(b, cap);
  cin.rdbuf(originalIn);
  cout.rdbuf(originalOut);
  if (left.str() != right.str()) {
    cout << "representation-mismatch\n";
    return 0;
  }
  cout << left.str();
  return 0;
#else
  ArrayList a(cap);
#endif
#if REPRESENTATION != 3
  run(a, cap);
#endif
}
