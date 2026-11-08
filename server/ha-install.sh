#!/usr/bin/env bash
# Stawia Home Assistanta w Dockerze obok innych aplikacji na serwerze.
# Zasady: nie dotyka istniejących kontenerów, conf.d ani tras innych aplikacji.
# Do Caddyfile tylko dopisuje osobny blok, po kopii i walidacji.
set -euo pipefail
main() {
HOST=dom.188-68-247-201.sslip.io
PORT=18123
NAME=smart-home-ha
DIR=/opt/smart-home-ha
MAC_SHA=112636be39a9e3d084754b1fc77c999839c88d3b
CF=/etc/caddy/Caddyfile

[ "$(id -u)" -eq 0 ] || { echo "Uruchom jako root."; exit 1; }
command -v docker >/dev/null || { echo "STOP: brak Dockera."; exit 2; }
command -v caddy >/dev/null || { echo "STOP: brak Caddy."; exit 2; }
FREE=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
echo "Wolna pamięć: ${FREE} MB"
[ "$FREE" -ge 700 ] || { echo "STOP: za mało wolnej pamięci (potrzeba 700 MB). Nic nie zmieniono."; exit 2; }

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "Kontener $NAME już istnieje, aktualizuję tylko jego."
else
  if ss -ltnH "( sport = :$PORT )" | grep -q .; then echo "STOP: port $PORT zajęty. Nic nie zmieniono."; exit 2; fi
fi

mkdir -p "$DIR/config/custom_components"
if [ ! -f "$DIR/config/configuration.yaml" ]; then
  cat > "$DIR/config/configuration.yaml" <<'YAML'
default_config:

http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - 172.16.0.0/12
  cors_allowed_origins:
    - https://lewym90.github.io
YAML
fi

echo "Pobieram integrację Midea (chmura MSmartHome)..."
TMP=$(mktemp -d)
curl -fsSL "https://codeload.github.com/sususweet/midea_auto_cloud/tar.gz/$MAC_SHA" | tar -xz -C "$TMP"
rm -rf "$DIR/config/custom_components/midea_auto_cloud"
cp -r "$TMP"/*/custom_components/midea_auto_cloud "$DIR/config/custom_components/"
rm -rf "$TMP"

echo "Uruchamiam Home Assistanta (pierwsze pobranie trwa kilka minut)..."
docker pull -q ghcr.io/home-assistant/home-assistant:stable >/dev/null
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped --memory 1200m \
  -e TZ=Europe/Warsaw -v "$DIR/config:/config" \
  -p 127.0.0.1:$PORT:8123 ghcr.io/home-assistant/home-assistant:stable >/dev/null

if ! grep -q "^$HOST" "$CF"; then
  cp "$CF" "$CF.przed-ha-$(date +%Y%m%d-%H%M%S)"
  cp "$CF" /tmp/Caddyfile.ha
  printf '\n%s {\n\treverse_proxy 127.0.0.1:%s\n}\n' "$HOST" "$PORT" >> /tmp/Caddyfile.ha
  if caddy validate --config /tmp/Caddyfile.ha --adapter caddyfile >/dev/null 2>&1; then
    cp /tmp/Caddyfile.ha "$CF"; systemctl reload caddy; echo "Dodano adres $HOST"
  else
    echo "STOP: nowa konfiguracja Caddy nie przeszła walidacji, Caddyfile bez zmian."; exit 2
  fi
fi

echo "Czekam, aż Home Assistant wstanie..."
for i in $(seq 1 60); do curl -fs -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 5; done
sleep 10
CODE=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "https://$HOST/" || true)
echo
echo "Home Assistant: $([ "$CODE" = 200 ] && echo OK || echo "kod $CODE, sprawdź za minutę")"
echo "Adres: https://$HOST"
for u in /zdrowie /smart-home-push/health; do curl -s -o /dev/null -m 8 -w "kontrola $u %{http_code}\n" "https://188-68-247-201.sslip.io$u"; done
curl -s -o /dev/null -m 8 -w "kontrola planer %{http_code}\n" https://planer.188-68-247-201.sslip.io/
}
main </dev/null
