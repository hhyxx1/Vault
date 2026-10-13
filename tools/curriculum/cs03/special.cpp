#include <algorithm>
#include <cctype>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;
struct GNode {
  bool atom = false;
  string value;
  vector<unique_ptr<GNode>> children;
};
struct Parser {
  string s;
  size_t i = 0;
  unique_ptr<GNode> element() {
    if (i == s.size())
      throw runtime_error("end");
    auto node = make_unique<GNode>();
    if (s[i] != '(') {
      node->atom = true;
      size_t begin = i;
      if (s[i] == '-')
        ++i;
      size_t digits = i;
      while (i < s.size() && isdigit(static_cast<unsigned char>(s[i])))
        ++i;
      if (i == digits)
        throw runtime_error("atom");
      node->value = s.substr(begin, i - begin);
      return node;
    }
    ++i;
    if (i < s.size() && s[i] == ')') {
      ++i;
      return node;
    }
    while (true) {
      node->children.push_back(element());
      if (i == s.size())
        throw runtime_error("end");
      char delimiter = s[i++];
      if (delimiter == ')')
        return node;
      if (delimiter != ',')
        throw runtime_error("delimiter");
    }
  }
};
pair<int, int> properties(const GNode &node) {
  if (node.atom)
    return {0, 1};
  int depth = 1, atoms = 0;
  for (auto &child : node.children) {
    auto value = properties(*child);
    depth = max(depth, value.first + 1);
    atoms += value.second;
  }
  return {depth, atoms};
}
string serialize(const GNode &node) {
  if (node.atom)
    return node.value;
  string text = "(";
  bool first = true;
  for (auto &child : node.children) {
    if (!first)
      text += ",";
    first = false;
    text += serialize(*child);
  }
  return text + ")";
}
int main() {
  string mode;
  getline(cin, mode);
  if (mode == "COO") {
    int r, c, k;
    cin >> r >> c >> k;
    if (r < 1 || c < 1 || r > 50 || c > 50 || k < 0 || k > 2500) {
      cout << "invalid\n";
      return 0;
    }
    vector<vector<long long>> a(r, vector<long long>(c));
    for (int h = 0; h < k; ++h) {
      int i, j;
      long long x;
      if (!(cin >> i >> j >> x) || i < 0 || i >= r || j < 0 || j >= c) {
        cout << "invalid\n";
        return 0;
      }
      a[i][j] += x;
    }
    cout << "dense\n";
    for (int i = 0; i < r; ++i) {
      for (int j = 0; j < c; ++j) {
        if (j)
          cout << ' ';
        cout << a[i][j];
      }
      cout << '\n';
    }
    cout << "transpose\n";
    for (int j = 0; j < c; ++j) {
      for (int i = 0; i < r; ++i) {
        if (i)
          cout << ' ';
        cout << a[i][j];
      }
      cout << '\n';
    }
  } else if (mode == "GLIST") {
    string text;
    getline(cin, text);
    text.erase(remove(text.begin(), text.end(), ' '), text.end());
    try {
      Parser p{text};
      if (text.empty() || text[0] != '(')
        throw runtime_error("root");
      auto root = p.element();
      auto result = properties(*root);
      if (serialize(*root) != text)
        throw runtime_error("roundtrip");
      if (p.i != text.size())
        throw runtime_error("trailing");
      cout << "depth=" << result.first << " atoms=" << result.second << '\n';
    } catch (const exception &) {
      cout << "invalid\n";
    }
  } else
    cout << "invalid\n";
}
