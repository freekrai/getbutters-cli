#!/usr/bin/env bash
# Installs the butters CLI from the latest GitHub release.
#
#   curl -fsSL https://raw.githubusercontent.com/freekrai/getbutters-cli/main/scripts/install.sh | bash
#
# Environment:
#   BUTTERS_BIN_DIR   where to put the binary (default: ~/.local/bin)
#   BUTTERS_VERSION   a release tag such as v0.2.0 (default: latest)
set -euo pipefail

REPO="freekrai/getbutters-cli"
INSTALL_DIR="${BUTTERS_BIN_DIR:-$HOME/.local/bin}"
VERSION="${BUTTERS_VERSION:-latest}"
# Overridable so the tests can serve a fake release; not meant for users.
RELEASES_URL="${BUTTERS_RELEASES_URL:-https://github.com/$REPO/releases}"

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

case "$OS" in
  linux|darwin) ;;
  mingw*|msys*|cygwin*) OS="windows" ;;
  *) echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

if [ "$OS" = "windows" ] && [ "$ARCH" = "arm64" ]; then
  echo "Windows ARM64 is not built yet. See $RELEASES_URL for what is." >&2
  exit 1
fi

# The release assets are bare binaries, not archives.
ASSET="butters-${OS}-${ARCH}"
BINARY="butters"
if [ "$OS" = "windows" ]; then
  ASSET="${ASSET}.exe"
  BINARY="butters.exe"
fi

if [ "$VERSION" = "latest" ]; then
  BASE="$RELEASES_URL/latest/download"
else
  BASE="$RELEASES_URL/download/$VERSION"
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Downloading $ASSET ($VERSION)..."
curl -fsSL "$BASE/$ASSET" -o "$TMPDIR/$ASSET"
curl -fsSL "$BASE/SHA256SUMS" -o "$TMPDIR/SHA256SUMS"

echo "Verifying checksum..."
EXPECTED=$(awk -v f="$ASSET" '$2 == f || $2 == "*" f {print $1}' "$TMPDIR/SHA256SUMS")
if [ -z "$EXPECTED" ]; then
  echo "ERROR: no checksum for $ASSET in SHA256SUMS" >&2
  exit 1
fi
if command -v sha256sum > /dev/null; then
  ACTUAL=$(sha256sum "$TMPDIR/$ASSET" | awk '{print $1}')
else
  ACTUAL=$(shasum -a 256 "$TMPDIR/$ASSET" | awk '{print $1}')
fi
if [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "ERROR: checksum mismatch for $ASSET" >&2
  echo "  expected: $EXPECTED" >&2
  echo "  actual:   $ACTUAL" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
cp "$TMPDIR/$ASSET" "$INSTALL_DIR/$BINARY"
chmod +x "$INSTALL_DIR/$BINARY"

INSTALLED=$("$INSTALL_DIR/$BINARY" --version 2>/dev/null || echo "$VERSION")
echo ""
echo "butters $INSTALLED installed to $INSTALL_DIR/$BINARY"

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
  echo ""
  echo "Add $INSTALL_DIR to your PATH:"
  case "$(basename "${SHELL:-bash}")" in
    zsh)  echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
    fish) echo "  fish_add_path $INSTALL_DIR" ;;
    *)    echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc" ;;
  esac
fi

echo ""
echo "Next: create an API key at /app/api, export GETBUTTERS_API_KEY, and run 'butters list'."
