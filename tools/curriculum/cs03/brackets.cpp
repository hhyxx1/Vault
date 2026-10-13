#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main() {
  string line;
  while (getline(cin, line)) {
    vector<char> s;
    bool valid = true;
    for (char c : line) {
      if (c == '(' || c == '[' || c == '{')
        s.push_back(c);
      else if (c == ')' || c == ']' || c == '}') {
        char want = c == ')' ? '(' : c == ']' ? '[' : '{';
        if (s.empty() || s.back() != want) {
          valid = false;
          break;
        }
        s.pop_back();
      }
    }
    cout << (valid && s.empty() ? "balanced" : "unbalanced") << '\n';
  }
}
