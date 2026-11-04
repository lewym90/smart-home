#!/usr/bin/env bash
# Instaluje serwer powiadomień Smart Home na Ubuntu. Nie rusza niczego, jeśli porty 80/443 są zajęte.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Uruchom przez sudo."; exit 1; }
if ss -ltnpH '( sport = :80 or sport = :443 )' | grep -v caddy | grep -q .; then
  echo "STOP: porty 80 lub 443 zajmuje inny program. Nic nie zostało zmienione:"
  ss -ltnpH '( sport = :80 or sport = :443 )'
  exit 2
fi
IP=$(curl -4fsS https://api.ipify.org)
HOST="${IP//./-}.sslip.io"
DIR=/opt/smart-home-push
ENVF=/etc/smart-home-push.env
apt-get update -qq
apt-get install -y -qq caddy nodejs npm curl >/dev/null
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
cat > /etc/caddy/Caddyfile <<EOF
$HOST {
  reverse_proxy 127.0.0.1:8787
}
EOF
systemctl daemon-reload
systemctl enable --now smart-home-push >/dev/null
systemctl restart smart-home-push caddy
command -v ufw >/dev/null && ufw status | grep -q active && { ufw allow 80,443/tcp >/dev/null; }
sleep 8
. "$ENVF"
curl -fsS "https://$HOST/health" >/dev/null && STATUS=OK || STATUS="BŁĄD: https://$HOST/health nie odpowiada"
echo
echo "Status: $STATUS"
echo "Kod do aplikacji (Więcej, Powiadomienia):"
echo "https://$HOST#$APP_KEY"
echo
echo "Sekret dla Home Assistanta:"
echo "$NOTIFY_SECRET"
