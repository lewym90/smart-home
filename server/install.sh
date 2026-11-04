#!/usr/bin/env bash
# Instaluje serwer powiadomień Smart Home obok istniejących aplikacji. Dodaje tylko własną trasę w /etc/caddy/conf.d.
set -euo pipefail
# Bez pytań instalatora i bez restartów innych usług na tym serwerze.
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1
main() {
[ "$(id -u)" -eq 0 ] || { echo "Uruchom przez sudo."; exit 1; }
command -v caddy >/dev/null || { echo "STOP: ten skrypt wymaga działającego Caddy."; exit 2; }
IP=$(curl -4fsS https://api.ipify.org)
HOST="${IP//./-}.sslip.io"
PORT=18871
if ss -ltnpH "( sport = :$PORT )" | grep -v node | grep -q .; then echo "STOP: port $PORT jest zajęty."; exit 2; fi
DIR=/opt/smart-home-push
ENVF=/etc/smart-home-push.env
echo "Instaluję pakiety..."
apt-get update -qq
timeout 600 apt-get install -y -qq -o Dpkg::Options::=--force-confold nodejs npm curl >/dev/null
echo "Instaluję usługę powiadomień..."
id smarthome >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin smarthome
mkdir -p "$DIR" /var/lib/smart-home-push
BASE=https://raw.githubusercontent.com/lewym90/smart-home/main/server
curl -fsSL "$BASE/index.mjs" -o "$DIR/index.mjs"
curl -fsSL "$BASE/package.json" -o "$DIR/package.json"
(cd "$DIR" && npm install --omit=dev --silent)
chown -R smarthome: /var/lib/smart-home-push
if [ ! -f "$ENVF" ]; then
  VAPID=$(cd "$DIR" && node -e "const k=require('web-push').generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)")
  umask 077
  cat > "$ENVF" <<EOF
APP_KEY=$(openssl rand -hex 24)
NOTIFY_SECRET=$(openssl rand -hex 24)
VAPID_PUBLIC=${VAPID% *}
VAPID_PRIVATE=${VAPID#* }
VAPID_SUBJECT=https://$HOST
DATA_FILE=/var/lib/smart-home-push/subs.json
EOF
  chown smarthome: "$ENVF"
fi
grep -q '^PORT=' "$ENVF" && sed -i "s/^PORT=.*/PORT=$PORT/" "$ENVF" || echo "PORT=$PORT" >> "$ENVF"
cat > /etc/systemd/system/smart-home-push.service <<EOF
[Unit]
Description=Smart Home push
After=network-online.target
[Service]
User=smarthome
EnvironmentFile=$ENVF
WorkingDirectory=$DIR
ExecStart=$(command -v node) index.mjs
Restart=always
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/smart-home-push
[Install]
WantedBy=multi-user.target
EOF
# Główny blok strony należy do innych aplikacji. Własna trasa idzie wyłącznie do conf.d.
CF=/etc/caddy/Caddyfile
if ! grep -q 'conf.d' "$CF"; then echo "STOP: Caddyfile nie wczytuje conf.d. Nic nie zmieniam."; exit 2; fi
printf 'handle_path /smart-home-push/* {\n\treverse_proxy 127.0.0.1:%s\n}\n' "$PORT" > /etc/caddy/conf.d/smart-home-push.caddy
caddy validate --config "$CF" --adapter caddyfile >/dev/null
echo "Uruchamiam..."
systemctl daemon-reload
systemctl enable --now smart-home-push >/dev/null
systemctl restart smart-home-push
systemctl reload caddy
command -v ufw >/dev/null && ufw status | grep -q active && { ufw allow 80,443/tcp >/dev/null; }
sleep 20
. "$ENVF"
curl -fsS "https://$HOST/smart-home-push/health" >/dev/null && STATUS=OK || STATUS="BŁĄD: https://$HOST/smart-home-push/health nie odpowiada"
echo
echo "Status: $STATUS"
echo "Kod do aplikacji (Więcej, Powiadomienia):"
echo "https://$HOST/smart-home-push#$APP_KEY"
echo
echo "Sekret dla Home Assistanta:"
echo "$NOTIFY_SECRET"
}
main </dev/null
