#include <algorithm>
#include <climits>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
struct Node {
  int key, height = 1;
  Node *left = nullptr;
  Node *right = nullptr;
  explicit Node(int k) : key(k) {}
};
int h(Node *p) { return p ? p->height : 0; }
void update(Node *p) { p->height = 1 + max(h(p->left), h(p->right)); }
Node *rotateRight(Node *p) {
  Node *q = p->left;
  p->left = q->right;
  q->right = p;
  update(p);
  update(q);
  return q;
}
Node *rotateLeft(Node *p) {
  Node *q = p->right;
  p->right = q->left;
  q->left = p;
  update(p);
  update(q);
  return q;
}
Node *repair(Node *p) {
  if (!p)
    return p;
  update(p);
#if BALANCED
  if (h(p->left) - h(p->right) > 1) {
    if (h(p->left->left) < h(p->left->right))
      p->left = rotateLeft(p->left);
    return rotateRight(p);
  }
  if (h(p->right) - h(p->left) > 1) {
    if (h(p->right->right) < h(p->right->left))
      p->right = rotateRight(p->right);
    return rotateLeft(p);
  }
#endif
  return p;
}
Node *insert(Node *p, int key) {
  if (!p)
    return new Node(key);
  if (key < p->key)
    p->left = insert(p->left, key);
  else if (key > p->key)
    p->right = insert(p->right, key);
  return repair(p);
}
bool find(Node *p, int key) {
  while (p) {
    if (key == p->key)
      return true;
    p = key < p->key ? p->left : p->right;
  }
  return false;
}
Node *erase(Node *p, int key) {
  if (!p)
    return p;
  if (key < p->key)
    p->left = erase(p->left, key);
  else if (key > p->key)
    p->right = erase(p->right, key);
  else {
    if (!p->left || !p->right) {
      Node *child = p->left ? p->left : p->right;
      delete p;
      return child;
    }
    Node *next = p->right;
    while (next->left)
      next = next->left;
    p->key = next->key;
    p->right = erase(p->right, next->key);
  }
  return repair(p);
}
void ordered(Node *p, vector<int> &keys) {
  if (!p)
    return;
  ordered(p->left, keys);
  keys.push_back(p->key);
  ordered(p->right, keys);
}
bool valid(Node *p, long long low = LLONG_MIN, long long high = LLONG_MAX) {
  if (!p)
    return true;
  if (p->key <= low || p->key >= high || p->height != 1 + max(h(p->left), h(p->right)))
    return false;
#if BALANCED
  if (abs(h(p->left) - h(p->right)) > 1)
    return false;
#endif
  return valid(p->left, low, p->key) && valid(p->right, p->key, high);
}
void clear(Node *p) {
  if (!p)
    return;
  clear(p->left);
  clear(p->right);
  delete p;
}
int main() {
  Node *root = nullptr;
  string op;
  while (cin >> op) {
    if (op == "P") {
      vector<int> keys;
      ordered(root, keys);
      if (keys.empty())
        cout << "empty";
      for (int i = 0; i < int(keys.size()); ++i) {
        if (i)
          cout << ' ';
        cout << keys[i];
      }
      cout << '\n';
    } else if (op == "V")
      cout << (valid(root) ? "valid" : "corrupt") << '\n';
    else {
      int key;
      cin >> key;
      bool exists = find(root, key);
      if (op == "I") {
        cout << (exists ? "exists" : "inserted") << '\n';
        root = insert(root, key);
      } else if (op == "D") {
        cout << (exists ? "deleted" : "missing") << '\n';
        root = erase(root, key);
      } else if (op == "F")
        cout << (exists ? "found" : "missing") << '\n';
    }
  }
  clear(root);
}
