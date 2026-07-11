#!/bin/sh

set -eu
umask 077

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUTPUT_DIR=${CERT_OUTPUT_DIR:-$SCRIPT_DIR}
P2P_DIR="$OUTPUT_DIR/p2p"
TLS_DIR="$OUTPUT_DIR/tls"
TLS_DOMAIN=${1:-${TLS_DOMAIN:-dev.lossantosonline.com}}
TLS_DNS_NAMES=${TLS_DNS_NAMES:-$TLS_DOMAIN,*.$TLS_DOMAIN}
TLS_VALID_DAYS=${TLS_VALID_DAYS:-3650}

case "$TLS_DOMAIN" in
  *[!A-Za-z0-9.-]*|'')
    echo "Invalid TLS_DOMAIN: $TLS_DOMAIN" >&2
    exit 1
    ;;
esac

mkdir -p "$OUTPUT_DIR" "$P2P_DIR" "$TLS_DIR"

P2P_CA_KEY="$P2P_DIR/ca-key.pem"
P2P_CA_CERT="$P2P_DIR/ca-cert.pem"
TLS_KEY="$TLS_DIR/tls.key"
TLS_CERT="$TLS_DIR/tls.crt"

generate_p2p=1
generate_tls=1
if [ "${FORCE_CERT_REGEN:-0}" != "1" ]; then
  if [ -e "$P2P_CA_KEY" ] || [ -e "$P2P_CA_CERT" ]; then
    if [ ! -e "$P2P_CA_KEY" ] || [ ! -e "$P2P_CA_CERT" ]; then
      echo "The P2P CA is incomplete. Back up and remove the partial pair before regenerating it." >&2
      exit 1
    fi
    generate_p2p=0
  fi

  if [ "${FORCE_TLS_REGEN:-0}" != "1" ] && { [ -e "$TLS_KEY" ] || [ -e "$TLS_CERT" ]; }; then
    if [ ! -e "$TLS_KEY" ] || [ ! -e "$TLS_CERT" ]; then
      echo "The TLS certificate is incomplete. Back up and remove the partial pair before regenerating it." >&2
      exit 1
    fi
    generate_tls=0
  fi

  if [ "$generate_p2p" -eq 0 ] && [ "$generate_tls" -eq 0 ]; then
    echo "Refusing to replace the existing static TLS and P2P certificate material." >&2
    echo "Set FORCE_TLS_REGEN=1 to rotate only TLS, or FORCE_CERT_REGEN=1 to rotate both sets of game trust material." >&2
    exit 1
  fi
fi

CA_CONFIG=$(mktemp "$OUTPUT_DIR/.p2p-ca.XXXXXX")
TLS_CONFIG=$(mktemp "$OUTPUT_DIR/.tls-server.XXXXXX")
cleanup() {
  rm -f "$CA_CONFIG" "$TLS_CONFIG"
}
trap cleanup EXIT INT TERM

cat > "$CA_CONFIG" <<'EOF'
[ req ]
prompt = no
distinguished_name = distinguished_name
x509_extensions = v3_ca

[ distinguished_name ]
C = US
ST = CA
L = San Diego
O = Rockstar Games
OU = Rockstar Games Online
CN = RockstarP2PDTLS

[ v3_ca ]
basicConstraints = critical,CA:TRUE
keyUsage = critical,digitalSignature,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
EOF

cat > "$TLS_CONFIG" <<EOF
[ req ]
prompt = no
distinguished_name = distinguished_name
x509_extensions = v3_server

[ distinguished_name ]
CN = $TLS_DOMAIN
O = Los Santos Online

[ v3_server ]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName = @alt_names

[ alt_names ]
EOF

dns_index=1
old_ifs=$IFS
IFS=','
for dns_name in $TLS_DNS_NAMES; do
  dns_name=$(printf '%s' "$dns_name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  case "$dns_name" in
    *[!A-Za-z0-9.*-]*|'')
      echo "Invalid DNS name in TLS_DNS_NAMES: $dns_name" >&2
      exit 1
      ;;
  esac
  printf 'DNS.%s = %s\n' "$dns_index" "$dns_name" >> "$TLS_CONFIG"
  dns_index=$((dns_index + 1))
done
IFS=$old_ifs

if [ "$generate_p2p" -eq 1 ]; then
  echo "Generating static P2P CA..."
  openssl ecparam -name prime256v1 -genkey -noout -out "$P2P_CA_KEY"
  openssl req -new -x509 -key "$P2P_CA_KEY" -out "$P2P_CA_CERT" \
    -config "$CA_CONFIG" -days 7300 -sha256
  openssl x509 -in "$P2P_CA_CERT" -outform DER -out "$P2P_DIR/ca-cert.cer"
  chmod 600 "$P2P_CA_KEY" 2>/dev/null || true
  chmod 644 "$P2P_CA_CERT" "$P2P_DIR/ca-cert.cer" 2>/dev/null || true
else
  echo "Keeping existing static P2P CA."
  openssl x509 -in "$P2P_CA_CERT" -outform DER -out "$P2P_DIR/ca-cert.cer"
  chmod 644 "$P2P_DIR/ca-cert.cer" 2>/dev/null || true
fi

if [ "$generate_tls" -eq 1 ]; then
  echo "Generating static TLS certificate for $TLS_DOMAIN..."
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$TLS_KEY" 2>/dev/null
  openssl req -new -x509 -sha256 -key "$TLS_KEY" -out "$TLS_CERT" \
    -config "$TLS_CONFIG" -days "$TLS_VALID_DAYS"
  openssl x509 -in "$TLS_CERT" -outform DER -out "$TLS_DIR/tls.cer"
  cp "$TLS_DIR/tls.cer" "$TLS_DIR/$TLS_DOMAIN.cer"
  openssl x509 -in "$TLS_CERT" -outform DER \
    | openssl dgst -sha256 -r \
    | awk '{print $1}' > "$TLS_DIR/tls-cert-sha256.txt"
  chmod 600 "$TLS_KEY" 2>/dev/null || true
  chmod 644 "$TLS_CERT" "$TLS_DIR/tls.cer" "$TLS_DIR/$TLS_DOMAIN.cer" \
    "$TLS_DIR/tls-cert-sha256.txt" 2>/dev/null || true
else
  echo "Keeping existing static TLS certificate."
  openssl x509 -in "$TLS_CERT" -outform DER -out "$TLS_DIR/tls.cer"
  cp "$TLS_DIR/tls.cer" "$TLS_DIR/$TLS_DOMAIN.cer"
  openssl x509 -in "$TLS_CERT" -outform DER \
    | openssl dgst -sha256 -r \
    | awk '{print $1}' > "$TLS_DIR/tls-cert-sha256.txt"
  chmod 644 "$TLS_DIR/tls.cer" "$TLS_DIR/$TLS_DOMAIN.cer" \
    "$TLS_DIR/tls-cert-sha256.txt" 2>/dev/null || true
fi

echo
echo "Static certificate material generated:"
echo "  P2P CA private key: $P2P_CA_KEY"
echo "  P2P CA public cert: $P2P_CA_CERT"
echo "  P2P CA DER cert:    $P2P_DIR/ca-cert.cer"
echo "  TLS private key:    $TLS_KEY"
echo "  TLS server cert:    $TLS_CERT"
echo "  Game TLS pin:       $TLS_DIR/$TLS_DOMAIN.cer"
echo
echo "Keep both private keys secret and back them up. Do not regenerate them unless you are intentionally rotating the certificates embedded in the game."
