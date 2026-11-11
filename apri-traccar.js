// Pagine ponte per Traccar Client: configura, avvia e ferma il tracciamento da un link.
//
// WhatsApp rende cliccabili solo i link https://, l'app invece si apre con lo schema
// org.traccar.client:// (registrato da Traccar Client, Android e iPhone):
//   org.traccar.client://action/start   avvia il tracciamento, senza domande
//   org.traccar.client://action/stop    lo ferma
//   org.traccar.client://config?...     scrive le impostazioni (l'app chiede conferma e non avvia)
// Le chiavi della configurazione sono quelle dell'app (lib/preferences.dart e
// lib/configuration_service.dart di github.com/traccar/traccar-client).
// Nessun link porta l'ID del telefono: resta quello generato dall'app, uguale per tutti i link.

// Invio ogni 5 secondi (11/11/2026, prima versione a 5 minuti). L'app di serie manda anche ogni 75 m
// (distance 75): con distance e angle a 0 conta solo il tempo. heartbeat 300 fa arrivare la
// posizione almeno ogni 5 minuti anche a bus fermo, quando il rilevamento fermate sospende il GPS.
// accuracy 'highest' serve perche' su iPhone l'intervallo vale solo con la precisione massima.
export const IMPOSTAZIONI = Object.freeze({
  url: 'http://supporto.fsbusitalia.com:5055',
  interval: 5,
  distance: 0,
  angle: 0,
  heartbeat: 300,
  accuracy: 'highest',
  buffer: true,
  stop_detection: true,
});

const SCHEMA = 'org.traccar.client';
const STORE = {
  android: 'https://play.google.com/store/apps/details?id=org.traccar.client',
  iphone: 'https://apps.apple.com/it/app/traccar-client/id843156974',
};

const PAGINE = {
  configura: {
    percorso: 'config?' + new URLSearchParams(Object.entries(IMPOSTAZIONI).map(([k, v]) => [k, String(v)])),
    titolo: 'Configurazione di Traccar',
    testo: 'Traccar Client si sta aprendo per configurarsi.',
    pulsante: '⚙ Configura l\'app',
    colore: '#1f4e8c',
    note: [
      'Traccar chiede di applicare la configurazione: tocca OK. Per la posizione scegli «Consenti sempre».',
      'Poi manda su WhatsApp l\'«Identificatore del dispositivo» che trovi nelle impostazioni di Traccar.',
      'Se non si apre niente, tocca il pulsante. Se l\'app non c\'è, scaricala e riapri questo link.',
    ],
  },
  avvia: {
    percorso: 'action/start',
    titolo: 'Avvio del tracciamento',
    testo: 'Traccar Client si sta aprendo e avvia il tracciamento.',
    pulsante: '▶ Avvia tracciamento',
    colore: '#16a34a',
    note: ['Se non si apre niente, tocca il pulsante. Se ancora non parte, apri Traccar Client e accendi «Tracciamento continuo».'],
  },
  ferma: {
    percorso: 'action/stop',
    titolo: 'Fine del tracciamento',
    testo: 'Traccar Client si sta aprendo e ferma il tracciamento.',
    pulsante: '■ Ferma tracciamento',
    colore: '#dc2626',
    note: ['Se non si apre niente, tocca il pulsante. Se ancora non si ferma, apri Traccar Client e spegni «Tracciamento continuo».'],
  },
};

// Su Android un intent:// col pacchetto: se l'app manca, Chrome apre il Play Store.
export function linkApp(azione, userAgent) {
  const percorso = PAGINE[azione].percorso;
  if (/android/i.test(userAgent)) {
    return `intent://${percorso}#Intent;scheme=${SCHEMA};package=${SCHEMA};end`;
  }
  return `${SCHEMA}://${percorso}`;
}

function el(tag, testo, classe) {
  const e = document.createElement(tag);
  if (testo) e.textContent = testo;
  if (classe) e.className = classe;
  return e;
}

export function mostraPagina(azione) {
  const p = PAGINE[azione];
  const link = linkApp(azione, navigator.userAgent);
  const pulsante = el('a', p.pulsante, 'pulsante');
  pulsante.href = link;
  pulsante.style.background = p.colore;

  const store = el('p', 'Non hai l\'app? Scaricala per ', 'nota');
  const a = el('a', 'Android'); a.href = STORE.android;
  const i = el('a', 'iPhone'); i.href = STORE.iphone;
  store.append(a, ' o per ', i, '.');

  document.getElementById('pagina').append(
    el('h1', p.titolo), el('p', p.testo, 'testo'), pulsante,
    ...p.note.map(n => el('p', n, 'nota')), store,
  );
  // apre l'app da sola appena la pagina e' su; il pulsante resta se il browser la blocca
  setTimeout(() => location.replace(link), 300);
}
