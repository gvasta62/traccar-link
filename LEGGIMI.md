# Link Traccar Client (configura, avvia, ferma)

Tre pagine statiche che aprono Traccar Client sul telefono dell'autista, da mandare su WhatsApp
(che rende cliccabili solo i link https). Nate l'11/11/2026 sul modello dei link
`traccar-auto.vercel.app` di un amico, ma con l'invio **ogni 5 minuti**.

Pubblicate con GitHub Pages dal repository pubblico `gvasta62/traccar-link`:

- https://gvasta62.github.io/traccar-link/configura/  (solo la prima volta)
- https://gvasta62.github.io/traccar-link/avvia/      (prima di partire)
- https://gvasta62.github.io/traccar-link/ferma/      (a fine servizio)

Come funzionano: ogni pagina apre lo schema `org.traccar.client://` (su Android con un
`intent://`, che porta al Play Store se l'app manca): `action/start`, `action/stop`, oppure
`config?...` con le impostazioni. La configurazione l'app la chiede in conferma e non avvia il
tracciamento. Nessun link porta l'ID del telefono.

Impostazioni (in `apri-traccar.js`, `IMPOSTAZIONI`; chiavi da `lib/preferences.dart` di
traccar-client):

| chiave | valore | perché |
|---|---|---|
| url | http://supporto.fsbusitalia.com:5055 | lo stesso dei link dell'amico, scelto dall'utente |
| interval | 300 | 5 minuti |
| distance | 0 | di serie l'app manda anche ogni 75 m: a 0 conta solo il tempo |
| angle | 0 | niente invii extra in curva |
| heartbeat | 300 | una posizione ogni 5 minuti anche a bus fermo |
| accuracy | highest | su iPhone l'intervallo vale solo con la precisione massima |
| buffer | true | memorizza quando manca la rete |
| stop_detection | true | come di serie |

Per cambiare qualcosa: si modifica `apri-traccar.js`, poi commit e push; GitHub Pages pubblica
da solo in un paio di minuti. Le pagine sono pubbliche: contengono solo l'indirizzo del server.
Funziona uguale su Mac e Windows (solo file statici, nessuna compilazione).
