# Smart Home

Jeden dom. Jedna aplikacja. Koniec z żonglerką.

PWA na iPhone'a, iPada i komputer. Zbiera urządzenia różnych producentów w jednym miejscu. Mózgiem jest Home Assistant, aplikacja jest jego pilotem. Bez Home Assistanta działa w trybie demo.

## Uruchomienie

```bash
npm install
npm run dev      # podgląd lokalny
npm test         # testy
npm run build    # wersja produkcyjna w dist/
```

Każdy push na `main` publikuje aplikację na GitHub Pages (`.github/workflows/deploy.yml`). W ustawieniach repozytorium trzeba raz wybrać: Settings, Pages, Source: GitHub Actions.

## Podłączenie domu

1. Postaw Home Assistanta w domu i dodaj w nim urządzenia oraz obszary (to będą pokoje).
2. Udostępnij go przez https. Najprościej `tailscale serve` plus aplikacja Tailscale na telefonie. Zwykłe `http://192.168.x.x` nie zadziała, bo strona z https nie może łączyć się z http.
3. W profilu HA utwórz token długoterminowy, wpisz adres i token w aplikacji: Więcej, Połączenie.
4. Żeby tworzyć sceny i automatyzacje z aplikacji, dodaj w `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - https://TWOJ-LOGIN.github.io
```

## Powiadomienia przez serwer

Na serwerze z Ubuntu:

```bash
curl -fsSL https://raw.githubusercontent.com/lewym90/smart-home/main/server/install.sh | sudo bash
```

Skrypt instaluje Caddy (https) i usługę `smart-home-push`, a na końcu wypisuje kod do aplikacji i sekret dla Home Assistanta. Kod wklejasz w aplikacji: Więcej, Powiadomienia. W `configuration.yaml`:

```yaml
rest_command:
  smart_home_push:
    url: https://ADRES-SERWERA/notify
    method: POST
    headers:
      Authorization: Bearer SEKRET
    content_type: application/json
    payload: '{"title":"{{ title }}","body":"{{ body }}"}'
```

Automatyzacja wywołuje wtedy akcję `rest_command.smart_home_push` z polami `title` i `body`.

## Struktura

- `src/ha/types.ts`: wspólny interfejs `Provider`
- `src/ha/hass.ts`: Home Assistant (WebSocket, REST do zapisu konfiguracji)
- `src/ha/demo.ts`: symulowany dom
- `src/ha/model.ts`: zamiana encji HA na pokoje, urządzenia, alerty
- `src/store.tsx`: stan aplikacji
- `src/screens`, `src/components`: ekrany
- `public/img`: zdjęcia domu i pokoi. Podmiana pliku o tej samej nazwie wystarczy.
