// Files are private to one isolated execution. Browser versions preserve
// source/input/results.
#include <algorithm>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <map>
#include <queue>
#include <string>
#include <vector>
using namespace std;
struct Record {
  long long key;
  int tag;
};
bool read(ifstream &in, Record &r) { return bool(in >> r.key >> r.tag); }
void write(ofstream &out, const Record &r) {
  out << r.key << ' ' << r.tag << '\n';
  if (!out)
    throw runtime_error("write failed");
}
void external() {
  int n, block;
  cin >> n >> block;
  if (n < 0 || n > 200 || block < 2 || block > 100)
    throw runtime_error("invalid input");
  vector<string> runs;
  int peak = 0, passes = 0, serial = 0;
  for (int consumed = 0; consumed < n;) {
    vector<Record> chunk;
    for (int i = 0; i < block && consumed < n; ++i, ++consumed) {
      Record r;
      if (!(cin >> r.key >> r.tag))
        throw runtime_error("input failed");
      chunk.push_back(r);
    }
    peak = max(peak, int(chunk.size()));
    stable_sort(chunk.begin(), chunk.end(),
                [](const Record &a, const Record &b) { return a.key < b.key; });
    string name = "run" + to_string(serial++) + ".dat";
    ofstream out(name);
    if (!out)
      throw runtime_error("open failed");
    for (auto &r : chunk)
      write(out, r);
    out.flush();
    if (!out)
      throw runtime_error("flush failed");
    runs.push_back(name);
  }
  while (runs.size() > 1) {
    vector<string> next;
    for (int i = 0; i < int(runs.size()); i += 2) {
      if (i + 1 == int(runs.size())) {
        next.push_back(runs[i]);
        continue;
      }
      ifstream left(runs[i]), right(runs[i + 1]);
      if (!left || !right)
        throw runtime_error("open failed");
      string name = "run" + to_string(serial++) + ".dat";
      ofstream out(name);
      if (!out)
        throw runtime_error("open failed");
      Record a, b;
      bool hasA = read(left, a), hasB = read(right, b);
      peak = max(peak, int(hasA) + int(hasB));
      while (hasA || hasB) {
        if (hasA && (!hasB || a.key <= b.key)) {
          write(out, a);
          hasA = read(left, a);
        } else {
          write(out, b);
          hasB = read(right, b);
        }
      }
      out.flush();
      if (!out)
        throw runtime_error("flush failed");
      out.close();
      left.close();
      right.close();
      remove(runs[i].c_str());
      remove(runs[i + 1].c_str());
      next.push_back(name);
    }
    runs = next;
    ++passes;
  }
  cout << "{\"records\":[";
  if (!runs.empty()) {
    ifstream in(runs[0]);
    if (!in)
      throw runtime_error("open failed");
    Record r;
    bool first = true;
    while (read(in, r)) {
      if (!first)
        cout << ',';
      first = false;
      cout << '[' << r.key << ',' << r.tag << ']';
    }
    in.close();
    remove(runs[0].c_str());
  }
  cout << "],\"peak\":" << peak << ",\"passes\":" << passes << "}\n";
}
bool contains(const string &text, const string &pattern) {
  if (pattern.empty())
    return true;
  vector<int> pi(pattern.size());
  for (int i = 1; i < int(pattern.size()); ++i) {
    int j = pi[i - 1];
    while (j && pattern[i] != pattern[j])
      j = pi[j - 1];
    if (pattern[i] == pattern[j])
      ++j;
    pi[i] = j;
  }
  int j = 0;
  for (char c : text) {
    while (j && c != pattern[j])
      j = pi[j - 1];
    if (c == pattern[j])
      ++j;
    if (j == int(pattern.size()))
      return true;
  }
  return false;
}
void catalog() {
  int n, m;
  cin >> n >> m;
  map<int, string> documents;
  for (int i = 0; i < n; ++i) {
    int id;
    string title;
    cin >> id >> title;
    if (documents.count(id))
      throw runtime_error("duplicate id");
    documents[id] = title;
  }
  map<int, vector<int>> adj;
  for (int i = 0; i < m; ++i) {
    int a, b;
    cin >> a >> b;
    if (!documents.count(a) || !documents.count(b))
      throw runtime_error("unknown id");
    adj[a].push_back(b);
  }
  string query;
  getline(cin, query);
  getline(cin, query);
  int source, target;
  cin >> source >> target;
  if (!documents.count(source) || !documents.count(target))
    throw runtime_error("unknown endpoint");
  // Export and reload the catalogue records, checking actual bytes/data round trip.
  {
    ofstream out("catalog.dat");
    if (!out)
      throw runtime_error("open failed");
    for (auto &row : documents)
      out << row.first << ' ' << row.second << '\n';
    if (!out)
      throw runtime_error("write failed");
  }
  map<int, string> restored;
  {
    ifstream in("catalog.dat");
    int id;
    string title;
    while (in >> id >> title)
      restored[id] = title;
  }
  bool same = restored == documents;
  remove("catalog.dat");
  vector<int> matches;
  for (auto &row : restored)
    if (contains(row.second, query))
      matches.push_back(row.first);
  map<int, int> parent;
  queue<int> q;
  q.push(source);
  parent[source] = source;
  while (!q.empty()) {
    int u = q.front();
    q.pop();
    sort(adj[u].begin(), adj[u].end());
    for (int v : adj[u])
      if (!parent.count(v)) {
        parent[v] = u;
        q.push(v);
      }
  }
  vector<int> path;
  if (parent.count(target)) {
    for (int v = target;; v = parent[v]) {
      path.push_back(v);
      if (v == source)
        break;
    }
    reverse(path.begin(), path.end());
  }
  cout << "{\"matches\":[";
  for (int i = 0; i < int(matches.size()); ++i) {
    if (i)
      cout << ',';
    cout << matches[i];
  }
  cout << "],\"path\":[";
  for (int i = 0; i < int(path.size()); ++i) {
    if (i)
      cout << ',';
    cout << path[i];
  }
  cout << "],\"file_roundtrip\":" << (same ? "true" : "false") << "}\n";
}
int main() {
  try {
    string mode;
    getline(cin, mode);
    if (mode == "EXTERNAL")
      external();
    else if (mode == "CATALOG")
      catalog();
    else
      throw runtime_error("mode");
  } catch (const exception &e) {
    cerr << "io-or-input-error: " << e.what() << '\n';
    return 1;
  }
}
