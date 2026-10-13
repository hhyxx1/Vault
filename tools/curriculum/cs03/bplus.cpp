// Original order-3 B+ teaching tree. Records only in leaves; separator keys copied.
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
struct Node {
  bool leaf;
  vector<int> keys;
  vector<Node *> child;
  Node *next = nullptr;
  explicit Node(bool l) : leaf(l) {}
};
int minimum(Node *p) {
  while (!p->leaf)
    p = p->child.front();
  return p->keys.front();
}
void refresh(Node *p) {
  if (p->leaf)
    return;
  p->keys.clear();
  for (int i = 1; i < int(p->child.size()); ++i)
    p->keys.push_back(minimum(p->child[i]));
}
bool find(Node *p, int key) {
  while (!p->leaf) {
    int i = upper_bound(p->keys.begin(), p->keys.end(), key) - p->keys.begin();
    p = p->child[i];
  }
  return binary_search(p->keys.begin(), p->keys.end(), key);
}
Node *insert(Node *p, int key) {
  if (p->leaf) {
    p->keys.insert(lower_bound(p->keys.begin(), p->keys.end(), key), key);
    if (p->keys.size() <= 2)
      return nullptr;
    Node *right = new Node(true);
    right->keys.assign(p->keys.begin() + 1, p->keys.end());
    p->keys.resize(1);
    right->next = p->next;
    p->next = right;
    return right;
  }
  int i = upper_bound(p->keys.begin(), p->keys.end(), key) - p->keys.begin();
  Node *right = insert(p->child[i], key);
  if (right)
    p->child.insert(p->child.begin() + i + 1, right);
  refresh(p);
  if (p->child.size() <= 3)
    return nullptr;
  right = new Node(false);
  right->child.assign(p->child.begin() + 2, p->child.end());
  p->child.resize(2);
  refresh(p);
  refresh(right);
  return right;
}
int occupancy(Node *p) { return p->leaf ? p->keys.size() : p->child.size(); }
int required(Node *p) { return p->leaf ? 1 : 2; }
void join(Node *left, Node *right) {
  if (left->leaf) {
    left->keys.insert(left->keys.end(), right->keys.begin(), right->keys.end());
    left->next = right->next;
  } else {
    left->child.insert(left->child.end(), right->child.begin(), right->child.end());
    refresh(left);
  }
  delete right;
}
void erase(Node *p, int key) {
  if (p->leaf) {
    auto it = lower_bound(p->keys.begin(), p->keys.end(), key);
    if (it != p->keys.end() && *it == key)
      p->keys.erase(it);
    return;
  }
  int i = upper_bound(p->keys.begin(), p->keys.end(), key) - p->keys.begin();
  Node *node = p->child[i];
  erase(node, key);
  if (occupancy(node) < required(node)) {
    if (i > 0 && occupancy(p->child[i - 1]) > required(node)) {
      Node *left = p->child[i - 1];
      if (node->leaf) {
        node->keys.insert(node->keys.begin(), left->keys.back());
        left->keys.pop_back();
      } else {
        node->child.insert(node->child.begin(), left->child.back());
        left->child.pop_back();
        refresh(left);
        refresh(node);
      }
    } else if (i + 1 < int(p->child.size()) &&
               occupancy(p->child[i + 1]) > required(node)) {
      Node *right = p->child[i + 1];
      if (node->leaf) {
        node->keys.push_back(right->keys.front());
        right->keys.erase(right->keys.begin());
      } else {
        node->child.push_back(right->child.front());
        right->child.erase(right->child.begin());
        refresh(node);
        refresh(right);
      }
    } else if (i > 0) {
      join(p->child[i - 1], node);
      p->child.erase(p->child.begin() + i);
    } else if (p->child.size() > 1) {
      join(node, p->child[i + 1]);
      p->child.erase(p->child.begin() + i + 1);
    }
  }
  refresh(p);
}
void ordered(Node *root, vector<int> &keys) {
  Node *p = root;
  while (!p->leaf)
    p = p->child.front();
  while (p) {
    keys.insert(keys.end(), p->keys.begin(), p->keys.end());
    p = p->next;
  }
}
bool check(Node *p, bool root, int depth, int &leafDepth) {
  if (p->leaf) {
    if (p->keys.size() > 2 || (!root && p->keys.empty()) ||
        !is_sorted(p->keys.begin(), p->keys.end()) ||
        adjacent_find(p->keys.begin(), p->keys.end()) != p->keys.end())
      return false;
    if (leafDepth < 0)
      leafDepth = depth;
    return depth == leafDepth;
  }
  if (p->child.size() < 2 || p->child.size() > 3 ||
      p->keys.size() + 1 != p->child.size())
    return false;
  for (int i = 0; i < int(p->child.size()); ++i) {
    if (!check(p->child[i], false, depth + 1, leafDepth))
      return false;
    if (i && p->keys[i - 1] != minimum(p->child[i]))
      return false;
  }
  return true;
}
void clear(Node *p) {
  for (Node *child : p->child)
    clear(child);
  delete p;
}
int main() {
  Node *root = new Node(true);
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
    } else if (op == "V") {
      int leafDepth = -1;
      vector<int> keys;
      ordered(root, keys);
      cout << (check(root, true, 0, leafDepth) && is_sorted(keys.begin(), keys.end()) &&
                       adjacent_find(keys.begin(), keys.end()) == keys.end()
                   ? "valid"
                   : "corrupt")
           << '\n';
    } else {
      int key;
      cin >> key;
      bool exists = find(root, key);
      if (op == "I") {
        cout << (exists ? "exists" : "inserted") << '\n';
        if (!exists) {
          Node *right = insert(root, key);
          if (right) {
            Node *parent = new Node(false);
            parent->child = {root, right};
            refresh(parent);
            root = parent;
          }
        }
      } else if (op == "D") {
        cout << (exists ? "deleted" : "missing") << '\n';
        if (exists) {
          erase(root, key);
          if (!root->leaf && root->child.size() == 1) {
            Node *old = root;
            root = root->child[0];
            delete old;
          }
        }
      } else if (op == "F")
        cout << (exists ? "found" : "missing") << '\n';
    }
  }
  clear(root);
}
