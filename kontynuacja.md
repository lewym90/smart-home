# Smart Home: kontynuacja

Stan na 4.11.2026. Wersja 1.0 w trybie demo + działające połączenie z Home Assistant.

## Decyzje
- Aplikacja łączy się z Home Assistantem bezpośrednio. Własny serwer nie pośredniczy, bo dom ma działać bez niego (punkt 18 i 21 specyfikacji). Własny serwer zostaje na ewentualny push.
- Konta, role, MFA i historia są w Home Assistant, nie budujemy drugiej bazy.
- Logowanie tokenem długoterminowym. OAuth pominięty: przekierowanie na inną domenę w PWA na iOS otwiera osobne okno i nie wraca do aplikacji.
- Stos: React, TypeScript, Vite, home-assistant-js-websocket, lucide-react, vite-plugin-pwa. Publikacja: GitHub Pages przez Actions.

## Sprawdzone
- Testy jednostkowe: `npm test`.
- Prawdziwy Home Assistant 2026.2 z integracją demo: połączenie, sterowanie światłem, klimatyzacja, zapis automatyzacji i sceny, odczyt opisu automatyzacji.
- Utrata połączenia: baner, zablokowane polecenia. Service worker: start aplikacji offline.

## Ustalone z użytkownikiem
- Sterowanie spoza domu jest wymagane: Tailscale na telefonie albo tunel przez serwer.
- Powiadomienia (np. koniec prania) mają iść przez jego serwer.
- Zdjęcia domu i pokoi są już docelowe, od użytkownika.

## Potwierdzone na iPhonie
Przez użytkownika: instalacja na ekranie początkowym i próbne powiadomienie push.

## Niesprawdzone
- Prawdziwe urządzenia użytkownika. Pralka jest rozpoznawana po nazwie urządzenia i encji, klasyfikator może wymagać dopasowania do konkretnej integracji.
- Wykres energii na prawdziwych statystykach HA (przetestowana tylko logika liczenia).

## Serwer
Na serwerze 188-68-247-201.sslip.io działa wiele innych aplikacji. Caddyfile należy do Typera, trasy innych aplikacji są w /etc/caddy/conf.d. Nigdy nie nadpisywać Caddyfile. Zajęte porty sprawdzać przed wyborem: 8787 Typer, 18787 nav-tts. Smart Home push: port 18871, trasa /smart-home-push/. Caddyfile po naprawie z 4.11.2026: blok główny (import conf.d, Typer na 8787) i planer.188-68-247-201.sslip.io na 8788; kopie: Caddyfile.po-awarii, Caddyfile.przed-planerem.

## Pełny ekran na iOS
Kalendarz d10b57a: iOS skraca okno, gdy dokument nie jest przewijalny, dlatego w index.html jest niewidoczny #docspacer. Interfejs .app jest fixed, przewija się main. Nie rozciągać interfejsu poza okno, bo iOS obcina dolny pasek.

## Urządzenia użytkownika
- Klimatyzacja: Kaisai Fly KWX-12KRHI, fabryka Midea, Wi-Fi wbudowane, aplikacja producenta KAISAI Smart.
- Pralka: Toshiba TW-BL80A2, z Wi-Fi, aplikacja TSmartLife (dostawca Midea).
- Termometry: dwa Shenzhen Farylink, bez modelu na etykiecie. Protokół nieustalony.
- Stan 8.11.2026: klima sparowana w MSmartHome, dwa termometry (balkon, mieszkanie) i osuszacz EBERG RICO R12E2 w Smart Life (Tuya). Waga Bluetooth jeszcze niesparowana.
- Decyzja użytkownika: zero sprzętu w domu. Home Assistant w Dockerze na serwerze (server/ha-install.sh, kontener smart-home-ha, port 127.0.0.1:18123, adres dom.188-68-247-201.sslip.io), integracje chmurowe: midea_auto_cloud (konto MSmartHome) i oficjalna Tuya (Smart Life).
- Pralka Toshiba: chmura TSmartLife zamknięta, brak działającej integracji. Gniazdko odpada (pralka za meblami w wynajętym mieszkaniu). Zostaje w TSmartLife. Nie obiecywać więcej.

## Do zrobienia
1. Uruchomić server/install.sh na serwerze użytkownika (wynajęty, Ubuntu 24.04, bez domeny: adres przez sslip.io).
2. Marki i modele urządzeń od użytkownika, postawienie HA.
3. Podpiąć w HA automatyzację końca prania do rest_command.smart_home_push. Serwer push jest w server/, kod jest gotowy.
4. Wersja 2: kreator automatyzacji z warunkami, analityka, raporty energii.

## Ograniczenia PWA względem specyfikacji
Widżety iOS, Siri, Apple Watch i geofencing w tle nie są dostępne dla PWA. Obecność domowników daje aplikacja HA Companion (encje person), resztę wymagałaby aplikacja natywna.
Uprawnienia per urządzenie: HA nie egzekwuje ich dla zwykłych użytkowników, więc ukrycie w aplikacji nie byłoby zabezpieczeniem.
