# Link Traccar Client (configura, avvia, ferma)

Tre pagine statiche che aprono Traccar Client sul telefono dell'autista, da mandare su WhatsApp
(che rende cliccabili solo i link https). Nate l'11/11/2026 sul modello dei link
`traccar-auto.vercel.app` di un amico, ma con l'invio **ogni 5 secondi** (la prima versione dell'11/11 era a 5 minuti).

Pubblicate con GitHub Pages dal repository pubblico `gvasta62/traccar-link`, **dal 26/11/2026 sul dominio aziendale
`https://qrbirs.fsbusitalia.com/`** (record DNS CNAME verso `gvasta62.github.io` creato dal collega Caimmi, file `CNAME`
nel repository, certificato HTTPS di GitHub, «Enforce HTTPS» attivo). Gli indirizzi `gvasta62.github.io/traccar-link/...`
qui sotto restano validi: rimandano al nuovo dominio, con il `#` (codice dei QR) e senza ristampe.
Da usare nei messaggi nuovi: `https://qrbirs.fsbusitalia.com/configura/`, `/avvia/`, `/ferma/`.
Indirizzi originali:

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
| interval | 5 | 5 secondi, voluto dall'utente |
| distance | 0 | di serie l'app manda anche ogni 75 m: a 0 conta solo il tempo |
| angle | 0 | niente invii extra in curva |
| heartbeat | 300 | almeno una posizione ogni 5 minuti anche a bus fermo |
| accuracy | highest | su iPhone l'intervallo vale solo con la precisione massima |
| buffer | true | memorizza quando manca la rete |
| stop_detection | true | come di serie |

Per cambiare qualcosa: si modifica `apri-traccar.js`, poi commit e push; GitHub Pages pubblica
da solo in un paio di minuti. Le pagine sono pubbliche: contengono solo l'indirizzo del server.
Funziona uguale su Mac e Windows (solo file statici, nessuna compilazione).


## QR posizione del bus (23/11/2026)

- `posizione/`: la mappa pubblica che si apre dal QR di una linea (`#t=<codice>`, il codice non è nel repository).
- `abbina/`: l'abbinamento dei telefoni alle linee. Parte comune in `abbina.js` e `abbina.css`; una pagina per linea in
  `abbina/<linea>/`, generata da `modello_linea.html` con `qr_posizione/crea_linea.py` (nome e colore in
  `qr_posizione/linee.json`); `abbina/` elenca le linee ed è la pagina dell'amministratore.
- `percorsi/<linea>.json`: percorso (una shape per direzione), fermate, e per ogni direzione fermate con i metri lungo il
  percorso, corse con gli orari e calendario, dal GTFS, scritti da `qr_posizione/gtfs_percorsi.py` (24/11/2026); li
  disegnano la mappa pubblica e la mappa di abbinamento, e la mappa pubblica ne ricava i minuti all'arrivo alla fermata
  scelta dal passeggero («Quanto manca alla tua fermata?»).
- `bus/<nome>/`: link brevi per i biglietti in app (26/11/2026), `https://qrbirs.fsbusitalia.com/bus/<nome>`; aprono
  `posizione/#t=<codice>`. **Contengono il codice della linea** (pubblico come le locandine, scelta dell'utente); li scrive
  `qr_posizione/crea_linea.py`.
- `sala/`: la mappa della sala operativa (26/11/2026), tutte le linee insieme in sola lettura; i codici stanno nel
  collegamento dopo il `#`, scritto da `qr_posizione/crea_sala.py`; `sala/linee.json` ha solo nomi e colori.
- `img/`: logo bianco e scia del piede (grafica Busitalia 05_2026).

Nessuna credenziale nelle pagine: l'operatore scrive la sua utenza, che resta nella scheda del browser. Dettagli in
`tracker_corse_sostitutive/qr_posizione/LEGGIMI.md`.
