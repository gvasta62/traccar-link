'use strict';
// Ogni linea è un utente Traccar «qr-<linea>» in sola lettura (creato da crea_linea.py). Il QR stampato contiene il
// suo codice d'accesso; questa pagina decide quale telefono quell'utente vede, togliendo tutti gli altri.
const SERVER = 'https://traccar.fsbusitalia.com';
const PREFISSO = 'qr-';
// una pagina per linea (abbina/milano-livigno/, abbina/padova-cortina/, ...): window.PAGINA_LINEA dice quale.
// Senza (abbina/), l'amministratore vede tutte le linee; ?linea=<codice> funziona ancora.
const PAGINA = window.PAGINA_LINEA || null;
const LINEA = (PAGINA ? PAGINA.codice : (new URLSearchParams(location.search).get('linea') || '')).trim().toLowerCase();
const $ = s => document.querySelector(s);
// percorsi e fermate dal GTFS (qr_posizione/gtfs_percorsi.py): link_traccar/percorsi/<codice>.json, accanto ad abbina/
const PERCORSI = new URL('../percorsi/', document.currentScript.src);
const CHIAVE = 'abbina_chiave_' + (LINEA || 'tutte');   // ogni pagina di linea ha il suo accesso
let chiave = sessionStorage.getItem(CHIAVE) || '';

async function api(percorso, metodo = 'GET', corpo) {
  const r = await fetch(SERVER + percorso, { method: metodo, cache: 'no-store',
    headers: { Authorization: 'Basic ' + chiave, Accept: 'application/json', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined });
  if (r.status === 401) throw new Error('Utente o password non validi.');
  if (!r.ok) throw new Error('Il server ha risposto ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

$('#modulo-accesso').onsubmit = async ev => {
  ev.preventDefault();
  chiave = btoa(unescape(encodeURIComponent($('#posta').value.trim() + ':' + $('#parola').value)));
  $('#entra').disabled = true; $('#esito-accesso').textContent = '';
  try { await carica(); sessionStorage.setItem(CHIAVE, chiave); }
  catch (e) { chiave = ''; $('#esito-accesso').textContent = e.message; }
  finally { $('#entra').disabled = false; }
};
$('#esci').onclick = () => { sessionStorage.removeItem(CHIAVE); location.reload(); };
$('#ricarica').onclick = () => carica().catch(e => alert(e.message));

function quando(iso) {
  if (!iso) return 'mai';
  const d = new Date(iso), s = Math.round((Date.now() - d) / 1000);
  const t = d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return t + (s < 120 ? ' (' + s + ' s fa)' : s < 7200 ? ' (' + Math.round(s / 60) + ' min fa)' : '');
}

async function carica() {
  const io = await api('/api/session?_=' + Date.now()).catch(() => null);  // solo per salutare: la prova vera è /api/users
  const utenti = await api('/api/users');
  const linee = utenti.filter(u => LINEA ? (u.email || '').toLowerCase() === PREFISSO + LINEA
                                        : (u.email || '').toLowerCase().startsWith(PREFISSO))
                      .sort((a, b) => a.email.localeCompare(b.email));
  $('#accesso').hidden = true; $('#lavoro').hidden = false;
  $('#chi').textContent = 'Collegato come ' + (io ? io.name : 'amministratore') + ' · ' + linee.length + (linee.length === 1 ? ' linea' : ' linee');
  const box = $('#linee'); box.innerHTML = '';
  if (!linee.length) box.innerHTML = LINEA
    ? '<p class="riquadro">Con questa utenza la linea «' + LINEA.replace(/[<>&"]/g, '') + '» non si vede: entra con l\'utenza dell\'operatore di questa linea o di amministratore.</p>'
    : '<p class="riquadro">Nessuna linea: va creata la prima con <code>crea_linea.py</code>.</p>';
  if (LINEA && linee.length && !PAGINA) $('#titolo').textContent = 'Abbinamento QR · ' + ((linee[0].attributes || {}).servizio || linee[0].name);
  for (const u of linee) {
    const codice = u.email.slice(PREFISSO.length).toLowerCase();
    // i punti della linea sono le geo aree collegate al suo utente QR con attributo linea=<codice>:
    // si leggono cosi' sia da amministratore sia da operatore della linea
    const geoaree = await api('/api/geofences?userId=' + u.id);
    const op = utenti.find(x => (x.email || '').toLowerCase() === 'op-' + codice);   // c'e' solo se entra l'amministratore
    const el = await scheda(u, geoaree.filter(g => ((g.attributes || {}).linea || '').toLowerCase() === codice), codice, op);
    box.appendChild(el); el._disegna();
  }
}

// Colori dei bus sulla mappa pubblica, una per direzione (Verde e Blu della palette FS): gli stessi qui
const COLORI_DIR = ['#00665B', '#004587', '#B91372', '#1B9AAA'];

// Le direzioni della linea (una per bus) stanno nell'attributo «direzioni» dell'utente QR, come testo JSON:
// [{"nome":"Crotone → Perugia","deviceId":15},{"nome":"Perugia → Crotone","deviceId":null}].
// Una linea con un bus solo ha una direzione senza nome. Le linee nate prima (senza attributo) si leggono dai telefoni.
function leggiDirezioni(u, codice, visti) {
  let dir = null;
  try { const v = JSON.parse((u.attributes || {}).direzioni || 'null'); if (Array.isArray(v) && v.length) dir = v; } catch (e) { /* attributo rovinato: si riparte */ }
  if (!dir) {
    const nomi = (PAGINA && PAGINA.codice === codice && PAGINA.direzioni && PAGINA.direzioni.length) ? PAGINA.direzioni : [''];
    dir = nomi.map(n => ({ nome: n, deviceId: null }));
  }
  dir = dir.map(x => ({ nome: x.nome || '', deviceId: x.deviceId == null ? null : +x.deviceId }));
  const ids = new Set(visti.map(d => d.id));
  dir.forEach(x => { if (x.deviceId != null && !ids.has(x.deviceId)) x.deviceId = null; });   // tolto da altre parti
  const liberi = visti.filter(d => !dir.some(x => x.deviceId === d.id));
  dir.forEach(x => { if (x.deviceId == null && liberi.length) x.deviceId = liberi.shift().id; });
  return { dir, inPiu: liberi };
}

async function scheda(u, punti, codice, op) {
  const el = $('#modello-linea').content.firstElementChild.cloneNode(true);
  const servizio = (u.attributes && u.attributes.servizio) || u.name;
  el.querySelector('.nome').textContent = servizio + '  ·  QR «' + u.email.slice(PREFISSO.length) + '»';
  el.querySelector('.servizio').value = servizio;
  const link = u.attributes && u.attributes.link;
  const apri = el.querySelector('.apri'); if (link) apri.href = link; else apri.hidden = true;
  const visti = await api('/api/devices?userId=' + u.id);
  const { dir, inPiu } = leggiDirezioni(u, codice, visti);
  const esito = el.querySelector('.esito');
  const occupato = v => el.querySelectorAll('button').forEach(b => b.disabled = v);
  const dici = (t, ok) => { esito.textContent = t; esito.className = 'esito ' + (ok ? 'ok' : 'errore'); };
  if (inPiu.length) dici('ATTENZIONE: la linea vede anche ' + inPiu.map(d => d.uniqueId).join(', ') + ': riabbina una direzione per sistemarla.', false);

  // lo stato vero si rilegge dal server prima di ogni modifica: la pagina puo' essere rimasta indietro (un abbinamento
  // appena fatto, un altro operatore sulla stessa linea) e lavorare sui dati vecchi toglierebbe un telefono abbinato
  async function statoAttuale() {
    const fresco = await api('/api/users/' + u.id);
    return leggiDirezioni(fresco, codice, await api('/api/devices?userId=' + u.id)).dir;
  }
  // dopo ogni modifica: la linea deve vedere esattamente i telefoni delle sue direzioni
  async function applica(nuove, messaggio) {
    const tenere = new Set(nuove.map(x => x.deviceId).filter(x => x != null));
    await togliTutto(u, tenere, punti);
    const gia = new Set((await api('/api/devices?userId=' + u.id)).map(d => d.id));
    for (const id of tenere) {
      if (!gia.has(id)) await api('/api/permissions', 'POST', { userId: u.id, deviceId: id });
      await geoareeAlTelefono(id, punti);
    }
    await scriviAttributi(u, { servizio: el.querySelector('.servizio').value.trim() || servizio, direzioni: JSON.stringify(nuove) });
    const ora = new Set((await api('/api/devices?userId=' + u.id)).map(d => d.id));
    if (ora.size !== tenere.size || [...tenere].some(id => !ora.has(id)))
      throw new Error('Controllo non superato: la linea vede ' + ora.size + ' telefoni invece di ' + tenere.size + '. Riprova.');
    dici(messaggio, true);
    setTimeout(() => carica().catch(() => {}), 1500);
  }

  dir.forEach((x, i) => {
    const f = $('#modello-direzione').content.firstElementChild.cloneNode(true);
    if (dir.length > 1) { f.style.setProperty('--dir', COLORI_DIR[i % COLORI_DIR.length]); f.querySelector('.d-nome').textContent = x.nome || ('Bus ' + (i + 1)); }
    const d = visti.find(v => v.id === x.deviceId);
    const quale = dir.length > 1 ? ' per «' + (x.nome || 'Bus ' + (i + 1)) + '»' : '';
    if (!d) f.querySelector('.adesso').textContent = 'Nessun telefono abbinato' + (dir.length > 1 ? ': questo bus non compare sulla mappa.' : ': il QR mostra «Nessun bus in condivisione».');
    else {
      f.querySelector('.adesso').textContent = 'Mostra adesso: ' + d.name + ' · ID ' + d.uniqueId;
      f.querySelector('.quando').textContent = 'Ultima posizione ricevuta: ' + quando(d.lastUpdate) + ' · ' + (d.status === 'online' ? 'in linea' : 'non in linea');
      f.querySelector('.id').value = d.uniqueId;
      const vecchia = !d.lastUpdate || (Date.now() - new Date(d.lastUpdate)) > 10 * 60 * 1000;
      f.querySelector('.punto').classList.add(vecchia ? 'vecchio' : 'attivo');
    }
    f.onsubmit = async ev => {
      ev.preventDefault(); occupato(true); dici('Abbino…', true);
      try {
        const id = f.querySelector('.id').value.trim();
        const trovati = await api('/api/devices?uniqueId=' + encodeURIComponent(id));
        if (!trovati.length) throw new Error('Nessun telefono con ID ' + id + ' su Traccar. Controlla il numero nell\'app Traccar Client (voce «Identificatore»).');
        const nuovo = trovati[0];
        const ora = await statoAttuale();
        const altra = ora.findIndex((y, j) => j !== i && y.deviceId === nuovo.id);
        if (altra >= 0) throw new Error('Il telefono ' + id + ' è già abbinato a «' + (ora[altra].nome || 'Bus ' + (altra + 1)) + '»: interrompi prima quella direzione.');
        const nuove = ora.map((y, j) => ({ nome: y.nome, deviceId: j === i ? nuovo.id : y.deviceId }));
        await applica(nuove, 'Fatto: il QR ora mostra ' + nuovo.name + ' (ID ' + nuovo.uniqueId + ')' + quale + '.');
      } catch (e) { dici(e.message, false); } finally { occupato(false); }
    };
    f.querySelector('.interrompi').onclick = async () => {
      occupato(true); dici('Interrompo…', true);
      try {
        const nuove = (await statoAttuale()).map((y, j) => ({ nome: y.nome, deviceId: j === i ? null : y.deviceId }));
        const resta = nuove.some(y => y.deviceId != null);
        await applica(nuove, 'Condivisione interrotta' + quale + (resta ? ': gli altri bus restano sulla mappa.' : ': il QR mostra «Nessun bus in condivisione».'));
      } catch (e) { dici(e.message, false); } finally { occupato(false); }
    };
    el.querySelector('.direzioni').appendChild(f);
  });
  el.querySelector('.salva-servizio').onclick = async () => {
    occupato(true);
    try { await scriviAttributi(u, { servizio: el.querySelector('.servizio').value.trim() || servizio }); dici('Nome del servizio salvato.', true); }
    catch (e) { dici(e.message, false); } finally { occupato(false); }
  };
  // ---- punti notevoli: geo aree Traccar con attributo linea=<codice> ----
  const corpo = el.querySelector('.punti');
  let mappa = null, strato = null, percorso = null;
  el._disegna = () => {
    mappa = L.map(el.querySelector('.mappa')).setView([45.9, 10.2], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mappa);
    mappa.createPane('percorso').style.zIndex = 350;      // sotto i punti notevoli
    percorso = L.featureGroup().addTo(mappa);
    strato = L.featureGroup().addTo(mappa);
    disegnaPercorso();
    mappa.on('click', ev => { el.querySelector('.p-coord').value = ev.latlng.lat.toFixed(6) + ', ' + ev.latlng.lng.toFixed(6); });
    elenca();
  };
  function elenca() {
    corpo.innerHTML = ''; strato.clearLayers();
    if (!punti.length) corpo.innerHTML = '<tr><td colspan="4" class="nota">Nessun punto per questa linea.</td></tr>';
    for (const g of punti) {
      const c = cerchio(g.area); const tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td></td><td></td><td><button type="button" class="ferma">Elimina</button></td>';
      tr.cells[0].textContent = g.name.replace(/^.*? · /, '');
      tr.cells[1].textContent = c ? c.lat.toFixed(5) + ', ' + c.lon.toFixed(5) : g.area;
      tr.cells[2].textContent = c ? Math.round(c.r) + ' m' : '';
      tr.querySelector('button').onclick = () => elimina(g);
      corpo.appendChild(tr);
      if (c) L.circle([c.lat, c.lon], { radius: c.r, color: '#00665B', weight: 2, fillOpacity: .15 }).addTo(strato)
               .bindTooltip(tr.cells[0].textContent, { permanent: true, direction: 'top' });
    }
    if (strato.getLayers().length) mappa.fitBounds(strato.getBounds().pad(0.3), { maxZoom: 14 });
    else if (percorso.getLayers().length) mappa.fitBounds(percorso.getBounds(), { padding: [16, 16] });
  }
  async function disegnaPercorso() {
    try {
      const r = await fetch(new URL(encodeURIComponent(codice) + '.json', PERCORSI));
      if (!r.ok) return;
      const p = await r.json();
      for (const d of p.direzioni || []) {
        L.polyline(d.punti, { pane: 'percorso', color: '#fff', weight: 7, opacity: .9, interactive: false }).addTo(percorso);
        L.polyline(d.punti, { pane: 'percorso', color: '#18213E', weight: 3, opacity: .65, interactive: false }).addTo(percorso);
      }
      // clic su una fermata: le sue coordinate vanno nel modulo, per farne un punto notevole
      for (const f of p.fermate || [])
        L.circleMarker([f.lat, f.lon], { pane: 'percorso', radius: 5, color: '#18213E', weight: 2, fillColor: '#fff', fillOpacity: 1 })
          .bindTooltip('Fermata GTFS · ' + f.nome, { direction: 'top' })
          .on('click', ev => { L.DomEvent.stopPropagation(ev); el.querySelector('.p-coord').value = f.lat.toFixed(6) + ', ' + f.lon.toFixed(6);
                               if (!el.querySelector('.p-nome').value) el.querySelector('.p-nome').value = f.nome; })
          .addTo(percorso);
      if (!strato.getLayers().length) mappa.fitBounds(percorso.getBounds(), { padding: [16, 16] });
    } catch (e) { /* senza percorso la pagina funziona lo stesso */ }
  }
  const esitoP = el.querySelector('.esito-punti');
  const diciP = (t, ok) => { esitoP.textContent = t; esitoP.className = 'esito esito-punti ' + (ok ? 'ok' : 'errore'); };
  el.querySelector('.nuovo-punto').onsubmit = async ev => {
    ev.preventDefault();
    const nome = el.querySelector('.p-nome').value.trim();
    const m = el.querySelector('.p-coord').value.match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
    const raggio = Math.round(+el.querySelector('.p-raggio').value);
    if (!m) { diciP('Coordinate non riconosciute: scrivi «46.1699, 9.8715» oppure clicca sulla mappa.', false); return; }
    const lat = +m[1].replace(',', '.'), lon = +m[2].replace(',', '.');
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) { diciP('Coordinate fuori scala.', false); return; }
    diciP('Aggiungo…', true);
    try {
      const servizio = (u.attributes && u.attributes.servizio) || u.name;
      const g = await api('/api/geofences', 'POST', { name: servizio + ' · ' + nome, description: 'Punto notevole della linea ' + servizio,
        area: 'CIRCLE (' + lat + ' ' + lon + ', ' + raggio + ')', attributes: { linea: codice } });
      await api('/api/permissions', 'POST', { userId: u.id, geofenceId: g.id });       // per la mappa pubblica
      if (op) await api('/api/permissions', 'POST', { userId: op.id, geofenceId: g.id }); // l'operatore deve poterlo spostare
      for (const d of await api('/api/devices?userId=' + u.id))                         // per il check-in e check-out
        await api('/api/permissions', 'POST', { deviceId: d.id, geofenceId: g.id });
      punti.push(g); elenca(); el.querySelector('.p-nome').value = ''; el.querySelector('.p-coord').value = '';
      diciP('Aggiunto «' + nome + '».', true);
    } catch (e) { diciP(e.message, false); }
  };
  async function elimina(g) {
    if (!confirm('Eliminare il punto «' + g.name + '»?')) return;
    try { await api('/api/geofences/' + g.id, 'DELETE'); punti.splice(punti.indexOf(g), 1); elenca(); diciP('Eliminato.', true); }
    catch (e) { diciP(e.message, false); }
  }
  return el;
}

function cerchio(area) {
  const m = /CIRCLE\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*,\s*([\d.]+)\s*\)/i.exec(area || '');
  return m ? { lat: +m[1], lon: +m[2], r: +m[3] } : null;
}

async function geoareeAlTelefono(deviceId, punti) {
  const gia = new Set((await api('/api/geofences?deviceId=' + deviceId)).map(g => g.id));
  for (const g of punti) if (!gia.has(g.id)) await api('/api/permissions', 'POST', { deviceId, geofenceId: g.id });
}

async function togliTutto(u, tenere, punti = []) {
  // via i gruppi (un gruppo farebbe vedere tutti i suoi telefoni) e via ogni telefono che non sta in una direzione
  for (const g of await api('/api/groups?userId=' + u.id))
    await api('/api/permissions', 'DELETE', { userId: u.id, groupId: g.id });
  for (const d of await api('/api/devices?userId=' + u.id))
    if (!tenere.has(d.id)) {
      // il telefono che esce dalla linea perde anche i punti notevoli: niente check-in a nome della linea
      const sue = new Set((await api('/api/geofences?deviceId=' + d.id)).map(g => g.id));
      for (const g of punti) if (sue.has(g.id)) await api('/api/permissions', 'DELETE', { deviceId: d.id, geofenceId: g.id });
      await api('/api/permissions', 'DELETE', { userId: u.id, deviceId: d.id });
    }
}

async function scriviAttributi(u, nuovi) {
  const attuale = await api('/api/users/' + u.id);
  const prima = attuale.attributes || {};
  if (Object.entries(nuovi).every(([k, v]) => prima[k] === v)) return;
  attuale.attributes = { ...prima, ...nuovi };
  await api('/api/users/' + u.id, 'PUT', attuale);
}

if (chiave) carica().catch(() => { sessionStorage.removeItem(CHIAVE); chiave = ''; });
