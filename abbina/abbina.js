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

async function scheda(u, punti, codice, op) {
  const el = $('#modello-linea').content.firstElementChild.cloneNode(true);
  const servizio = (u.attributes && u.attributes.servizio) || u.name;
  el.querySelector('.nome').textContent = servizio + '  ·  QR «' + u.email.slice(PREFISSO.length) + '»';
  el.querySelector('.servizio').value = servizio;
  const link = u.attributes && u.attributes.link;
  const apri = el.querySelector('.apri'); if (link) apri.href = link; else apri.hidden = true;
  const visti = await api('/api/devices?userId=' + u.id);
  const pallino = el.querySelector('.punto');
  if (!visti.length) { el.querySelector('.adesso').textContent = 'Nessun telefono abbinato: il QR mostra «Nessun bus in condivisione».'; }
  else {
    const d = visti[0];
    el.querySelector('.adesso').textContent = 'Mostra adesso: ' + d.name + ' · ID ' + d.uniqueId + (visti.length > 1 ? '  (ATTENZIONE: ' + visti.length + ' telefoni, riabbina)' : '');
    el.querySelector('.quando').textContent = 'Ultima posizione ricevuta: ' + quando(d.lastUpdate) + ' · ' + (d.status === 'online' ? 'in linea' : 'non in linea');
    el.querySelector('.id').value = d.uniqueId;
    const vecchia = !d.lastUpdate || (Date.now() - new Date(d.lastUpdate)) > 10 * 60 * 1000;
    pallino.classList.add(vecchia ? 'vecchio' : 'attivo');
  }
  const esito = el.querySelector('.esito');
  const occupato = v => el.querySelectorAll('button').forEach(b => b.disabled = v);
  const dici = (t, ok) => { esito.textContent = t; esito.className = 'esito ' + (ok ? 'ok' : 'errore'); };

  el.querySelector('.modulo').onsubmit = async ev => {
    ev.preventDefault(); occupato(true); dici('Abbino…', true);
    try {
      const id = el.querySelector('.id').value.trim();
      const trovati = await api('/api/devices?uniqueId=' + encodeURIComponent(id));
      if (!trovati.length) throw new Error('Nessun telefono con ID ' + id + ' su Traccar. Controlla il numero nell\'app Traccar Client (voce «Identificatore»).');
      const nuovo = trovati[0];
      await togliTutto(u, nuovo.id, punti);
      if (!(await api('/api/devices?userId=' + u.id)).some(d => d.id === nuovo.id))
        await api('/api/permissions', 'POST', { userId: u.id, deviceId: nuovo.id });
      await geoareeAlTelefono(nuovo.id, punti);
      await scriviServizio(u, el.querySelector('.servizio').value.trim());
      const ora = await api('/api/devices?userId=' + u.id);           // controllo: deve vedere quello e basta
      if (ora.length !== 1 || ora[0].id !== nuovo.id) throw new Error('Controllo non superato: la linea vede ' + ora.length + ' telefoni. Riprova.');
      dici('Fatto: il QR ora mostra ' + nuovo.name + ' (ID ' + nuovo.uniqueId + ').', true);
      setTimeout(() => carica().catch(() => {}), 1500);
    } catch (e) { dici(e.message, false); } finally { occupato(false); }
  };
  el.querySelector('.interrompi').onclick = async () => {
    occupato(true); dici('Interrompo…', true);
    try {
      await togliTutto(u, null, punti);
      const ora = await api('/api/devices?userId=' + u.id);
      if (ora.length) throw new Error('Controllo non superato: la linea vede ancora ' + ora.length + ' telefoni.');
      dici('Condivisione interrotta: il QR mostra «Nessun bus in condivisione».', true);
      setTimeout(() => carica().catch(() => {}), 1500);
    } catch (e) { dici(e.message, false); } finally { occupato(false); }
  };
  // ---- punti notevoli: geo aree Traccar con attributo linea=<codice> ----
  const corpo = el.querySelector('.punti');
  let mappa = null, strato = null;
  el._disegna = () => {
    mappa = L.map(el.querySelector('.mappa')).setView([45.9, 10.2], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mappa);
    strato = L.featureGroup().addTo(mappa);
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

async function togliTutto(u, tranne, punti = []) {
  // via i gruppi (un gruppo farebbe vedere tutti i suoi telefoni) e via ogni telefono diverso da quello scelto
  for (const g of await api('/api/groups?userId=' + u.id))
    await api('/api/permissions', 'DELETE', { userId: u.id, groupId: g.id });
  for (const d of await api('/api/devices?userId=' + u.id))
    if (d.id !== tranne) {
      // il telefono che esce dalla linea perde anche i punti notevoli: niente check-in a nome della linea
      const sue = new Set((await api('/api/geofences?deviceId=' + d.id)).map(g => g.id));
      for (const g of punti) if (sue.has(g.id)) await api('/api/permissions', 'DELETE', { deviceId: d.id, geofenceId: g.id });
      await api('/api/permissions', 'DELETE', { userId: u.id, deviceId: d.id });
    }
}

async function scriviServizio(u, servizio) {
  if (!servizio) return;
  const attuale = await api('/api/users/' + u.id);
  if ((attuale.attributes || {}).servizio === servizio) return;
  attuale.attributes = { ...(attuale.attributes || {}), servizio };
  await api('/api/users/' + u.id, 'PUT', attuale);
}

if (chiave) carica().catch(() => { sessionStorage.removeItem(CHIAVE); chiave = ''; });
