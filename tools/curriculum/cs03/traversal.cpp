#include <functional>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main() {
  int n, root;
  cin >> n >> root;
  if (n < 0 || n > 100) {
    cout << "invalid\n";
    return 0;
  }
  if (!n) {
    cout << (root == -1 ? "empty" : "invalid") << '\n';
    return 0;
  }
  if (root < 0 || root >= n) {
    cout << "invalid\n";
    return 0;
  }
  vector<int> left(n), right(n), seen(n), pre, in, post, iter;
  for (int i = 0; i < n; ++i) {
    cin >> left[i] >> right[i];
    if (left[i] < -1 || left[i] >= n || right[i] < -1 || right[i] >= n) {
      cout << "invalid\n";
      return 0;
    }
  }
  bool valid = true;
  function<void(int)> visit = [&](int node) {
    if (node == -1 || !valid)
      return;
    if (seen[node]) {
      valid = false;
      return;
    }
    seen[node] = 1;
    pre.push_back(node);
    visit(left[node]);
    in.push_back(node);
    visit(right[node]);
    post.push_back(node);
  };
  visit(root);
  if (!valid || int(pre.size()) != n) {
    cout << "invalid\n";
    return 0;
  }
  vector<int> stack;
  int node = root;
  while (node != -1 || !stack.empty()) {
    while (node != -1) {
      stack.push_back(node);
      node = left[node];
    }
    node = stack.back();
    stack.pop_back();
    iter.push_back(node);
    node = right[node];
  }
  auto print = [&](string name, const vector<int> &v) {
    cout << name << '=';
    for (int i = 0; i < int(v.size()); ++i) {
      if (i)
        cout << ' ';
      cout << v[i];
    }
    cout << '\n';
  };
  print("pre", pre);
  print("in", in);
  print("post", post);
  print("iter_in", iter);
}
