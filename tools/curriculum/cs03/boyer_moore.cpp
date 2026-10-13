#include <algorithm>
#include <array>
#include <iostream>
#include <string>
#include <vector>

static void preprocessStrongSuffix(const std::string& pattern,
                                   std::vector<int>& shift,
                                   std::vector<int>& border) {
  const int length = static_cast<int>(pattern.size());
  int i = length;
  int j = length + 1;
  border[i] = j;
  while (i > 0) {
    while (j <= length && pattern[i - 1] != pattern[j - 1]) {
      if (shift[j] == 0) shift[j] = j - i;
      j = border[j];
    }
    --i;
    --j;
    border[i] = j;
  }
}

static void preprocessCaseTwo(const std::string& pattern,
                              std::vector<int>& shift,
                              const std::vector<int>& border) {
  const int length = static_cast<int>(pattern.size());
  int j = border[0];
  for (int i = 0; i <= length; ++i) {
    if (shift[i] == 0) shift[i] = j;
    if (i == j) j = border[j];
  }
}

static std::vector<int> boyerMoore(const std::string& text,
                                   const std::string& pattern) {
  std::vector<int> matches;
  const int n = static_cast<int>(text.size());
  const int m = static_cast<int>(pattern.size());
  if (m == 0) {
    for (int i = 0; i <= n; ++i) matches.push_back(i);
    return matches;
  }
  if (m > n) return matches;

  std::array<int, 256> last;
  last.fill(-1);
  for (int i = 0; i < m; ++i)
    last[static_cast<unsigned char>(pattern[i])] = i;

  std::vector<int> shift(m + 1, 0);
  std::vector<int> border(m + 1, 0);
  preprocessStrongSuffix(pattern, shift, border);
  preprocessCaseTwo(pattern, shift, border);

  int offset = 0;
  while (offset <= n - m) {
    int j = m - 1;
    while (j >= 0 && pattern[j] == text[offset + j]) --j;
    if (j < 0) {
      matches.push_back(offset);
      offset += shift[0];
    } else {
      const int badCharacter = j - last[static_cast<unsigned char>(text[offset + j])];
      offset += std::max(shift[j + 1], std::max(1, badCharacter));
    }
  }
  return matches;
}

int main() {
  std::string text;
  std::string pattern;
  if (!std::getline(std::cin, text) || !std::getline(std::cin, pattern)) return 1;
  const auto matches = boyerMoore(text, pattern);
  if (matches.empty()) {
    std::cout << "none\n";
  } else {
    for (std::size_t i = 0; i < matches.size(); ++i) {
      if (i) std::cout << ' ';
      std::cout << matches[i];
    }
    std::cout << '\n';
  }
}
