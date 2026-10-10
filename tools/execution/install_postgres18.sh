#!/usr/bin/env bash
# Dedicated Ubuntu24.04 amd64 development worker only; no host cluster is installed.
set -eu
[ "$(id -u)" -eq 0 ] || { echo 'Run on the dedicated worker as root.' >&2; exit 1; }
. /etc/os-release
[ "$ID:$VERSION_ID:$(dpkg --print-architecture)" = 'ubuntu:24.04:amd64' ] || exit 1
repository=$(cd "$(dirname "$0")/../.." && pwd)
install -d /usr/share/postgresql-common/pgdg
curl --fail --silent --show-error https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
printf '%s\n' 'Types: deb' 'URIs: https://apt.postgresql.org/pub/repos/apt' 'Suites: noble-pgdg' 'Architectures: amd64' 'Components: main' 'Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc' > /etc/apt/sources.list.d/vault-pgdg.sources
apt-get update -qq
package_dir=$(mktemp -d /tmp/vault-pg18-packages.XXXXXX)
cd "$package_dir"
apt-get download postgresql-18=18.6-1.pgdg24.04+2 postgresql-client-18=18.6-1.pgdg24.04+2 libpq5=18.6-1.pgdg24.04+2 liburing2=2.5-1build1
cat > SHA256SUMS <<'SUMS'
c0773357df8769abb70e92722196d9b53422d71c0f29a4f39c834b94276cfa3d  postgresql-18_18.6-1.pgdg24.04+2_amd64.deb
b9d10d99a73bf7aa375be2fe36626c40499cfdf553d0ad174674a88a1b256b43  postgresql-client-18_18.6-1.pgdg24.04+2_amd64.deb
b487c5ed2ceb9244c6a9d6ae65818ed6707c3c44a2e14488394ae4194c52c53b  libpq5_18.6-1.pgdg24.04+2_amd64.deb
c2aef62accee92a06263c3ad4ef46132c13e409b54296c44792a20491830a7b0  liburing2_2.5-1build1_amd64.deb
SUMS
sha256sum --check SHA256SUMS
install -d /opt/vault-toolchains/pg18
for package in ./*.deb; do dpkg-deb --extract "$package" /opt/vault-toolchains/pg18; done
install -m 644 "$repository/tools/execution/postgres_runner.py" /opt/vault-toolchains/pg18/run_sql.py
chmod -R go-w /opt/vault-toolchains/pg18
LD_LIBRARY_PATH=/opt/vault-toolchains/pg18/usr/lib/x86_64-linux-gnu /opt/vault-toolchains/pg18/usr/lib/postgresql/18/bin/postgres --version
