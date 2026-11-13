/* Entrevero Futsal Clube – app */
'use strict';

// estilos que vieram dentro do <body> vão para o <head> (o app redesenha o body)
document.querySelectorAll('body style, body link[rel=stylesheet], body link[rel=preconnect], body title').forEach(n => document.head.appendChild(n));
const API = (window.EFC_API || '').trim();
const DEMO = !API;
const $ = (s, el = document) => el.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let t = String(v ?? '').replace(/R\$\s?/g, '').replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t); return isNaN(n) ? 0 : n;
};
const moeda = n => 'R$ ' + (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vMoeda = v => blank(v) ? '' : moeda(num(v));
// campo de dinheiro: digita só números e ele vai formando R$ 0,00
const campoMoeda = (nome, valor, extra = '') => `<input class="in money" name="${nome}" inputmode="numeric" autocomplete="off" placeholder="R$ 0,00" value="${esc(vMoeda(valor))}" ${extra}>`;
function formDados(f) {
  const o = Object.fromEntries(new FormData(f));
  f.querySelectorAll('input.money').forEach(i => { if (i.name in o) o[i.name] = blank(i.value) ? '' : num(i.value); });
  return o;
}
document.addEventListener('focusin', e => { const el = e.target; if (el.classList && el.classList.contains('money')) setTimeout(() => { try { el.select(); } catch (x) { } }, 0); });
document.addEventListener('input', e => {
  const el = e.target; if (!el.classList || !el.classList.contains('money')) return;
  const dig = el.value.replace(/\D/g, '').replace(/^0+/, '');
  el.value = dig ? moeda(parseInt(dig, 10) / 100) : '';
  try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) { }
});
const yes = v => String(v) === 'S';
const blank = v => v === null || v === undefined || String(v).trim() === '';
const csv = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const brl = v => 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = v => num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DIAS = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const dt = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const fdata = s => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) + '/' + String(s).slice(0, 4) : '';
const fcurta = s => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) : '';
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hoje = () => iso(new Date());

const st = {
  token: (() => { try { return localStorage.getItem(DEMO ? 'efc_token_demo' : 'efc_token') || ''; } catch (e) { return ''; } })(), user: null, d: null, fotos: {},
  tab: 'inicio', jogoId: null, jogoTab: 'lista', tabTab: 'pontos', granaTab: 'caixa', eventoId: null,
  rascunho: null, midiaLocal: {}, jogadorId: null
};

/* ================= comunicação ================= */
let server = null;
async function demoInit() {
  let db = null;
  try { db = JSON.parse(localStorage.getItem('efc_demo_db')); } catch (e) { }
  if (!db) { db = await (await fetch('seed.json')).json(); }
  const save = () => { try { localStorage.setItem('efc_demo_db', JSON.stringify(db)); } catch (e) { } };
  server = new EfcServer({
    read: t => (db[t] = db[t] || []),
    upsert: (t, o) => {
      const k = t === 'Historico' ? 'jogadorId' : 'id';
      const a = db[t] = db[t] || [], i = a.findIndex(x => String(x[k]) === String(o[k]));
      const c = JSON.parse(JSON.stringify(o)); if (i >= 0) a[i] = c; else a.push(c); save();
    },
    remove: (t, id) => { db[t] = (db[t] || []).filter(x => String(x.id) !== String(id)); save(); },
    saveFile: (nome, mime, b64) => { const k = 'demo:' + Math.random().toString(36).slice(2); st.midiaLocal[k] = 'data:' + mime + ';base64,' + b64; return k; },
    deleteFile: k => { delete st.midiaLocal[k]; },
    uuid: () => crypto.getRandomValues(new Uint32Array(4)).join('').slice(0, 24),
    withLock: fn => fn()
  });
}
/* escudo pulsando enquanto o app "pensa" */
const PENS = { n: 0, timer: null };
function pensar(liga) {
  PENS.n = Math.max(0, PENS.n + (liga ? 1 : -1));
  if (PENS.n > 0 && !PENS.timer && !document.querySelector('.pensando')) {
    PENS.timer = setTimeout(() => {
      PENS.timer = null; if (PENS.n === 0 || document.querySelector('.pensando') || document.querySelector('.carregando')) return;
      const d = document.createElement('div'); d.className = 'pensando'; d.innerHTML = '<img src="icons/escudo.png" alt="Carregando">';
      document.body.appendChild(d);
    }, 180);
  }
  if (PENS.n === 0) { clearTimeout(PENS.timer); PENS.timer = null; const d = document.querySelector('.pensando'); if (d) { d.classList.add('sai'); setTimeout(() => d.remove(), 160); } }
}
const telaCarregando = () => '<div class="carregando"><img src="icons/escudo.png" alt="Carregando"><span>Carregando...</span></div>';
const SILENCIOSAS = ['fotos', 'assinar', 'avisos'];
async function api(action, p = {}, silencioso) {
  const mostra = !silencioso && !SILENCIOSAS.includes(action);
  if (mostra) pensar(true);
  try { return await chamar(action, p); } finally { if (mostra) pensar(false); }
}
async function chamar(action, p) {
  const req = Object.assign({ action, token: st.token }, p);
  if (DEMO) {
    if (!server) await demoInit();
    await new Promise(r => setTimeout(r, 380)); // simula o tempo do servidor
    try { return JSON.parse(JSON.stringify(server.handle(JSON.parse(JSON.stringify(req))) || {})); }
    catch (e) { if (action !== 'login' && /login|Sessão/i.test(e.message)) sair(true); throw e; }
  }
  let r;
  try {
    r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req) });
  } catch (e) { throw new Error('Sem conexão. Tente de novo.'); }
  const j = await r.json();
  if (!j.ok) {
    if (action !== 'login' && /login|Sessão/i.test(j.erro || '')) { sair(true); }
    throw new Error(j.erro || 'Erro no servidor');
  }
  return j;
}
async function salvar(tabela, linhas, msg) {
  linhas = [].concat(linhas);
  const r = await api('salvar', { tabela, linhas });
  const arr = st.d[tabela] = st.d[tabela] || [];
  const k = tabela === 'Historico' ? 'jogadorId' : 'id';
  r.linhas.forEach(l => { const i = arr.findIndex(x => String(x[k]) === String(l[k])); if (i >= 0) arr[i] = l; else arr.push(l); });
  if (msg) toast(msg);
  render();
  return r;
}
async function excluir(tabela, ids, msg) {
  ids = [].concat(ids);
  await api('excluir', { tabela, ids });
  st.d[tabela] = st.d[tabela].filter(x => !ids.includes(String(x.id)));
  if (msg) toast(msg);
  render();
}
async function fazer(fn) {
  try { await fn(); } catch (e) { toast(e.message || String(e), true); }
}

/* ================= dados derivados ================= */
const D = () => st.d;
const admin = () => st.user && st.user.papel === 'admin';
const J = id => (D().Jogadores || []).find(j => String(j.id) === String(id));
const cfg = (k, def = '') => { const c = (D().Config || []).find(x => x.id === k); return c ? c.valor : def; };
const nomeI = i => i.jogadorId ? (J(i.jogadorId)?.apelido || '?') : i.nomeAvulso;
const jogo = id => (D().Jogos || []).find(j => j.id === id);
const jogosOrd = () => [...(D().Jogos || [])].sort((a, b) => a.data < b.data ? -1 : 1);
const inscritos = jid => (D().Inscricoes || []).filter(i => i.jogoId === jid).sort((a, b) => num(a.ordem) - num(b.ordem));
const valorI = (i, j) => !blank(i.valor) ? num(i.valor) : (yes(i.goleiro) ? num(j.valorGoleiro) : num(j.valorJogador));
const ativos = () => jogosOrd().filter(j => !yes(j.arquivado));
const travaJogo = j => { if (!blank(j.golsVermelho) || !blank(j.golsAzul)) return 'placar lançado';
  const ins = inscritos(j.id); if (ins.some(i => yes(i.pago))) return 'pagamento marcado'; if (ins.some(i => num(i.gols) > 0)) return 'gols lançados';
  if ((D().Votos || []).some(v => v.jogoId === j.id)) return 'votos'; return ''; };
const jogoAtual = () => { const o = ativos(); if (!o.length) return null; return o.find(j => j.status === 'aberta') || o.filter(j => j.status !== 'encerrada').pop() || o[o.length - 1]; };
const temResultado = j => !blank(j.golsVermelho) && !blank(j.golsAzul) && !yes(j.legado);

function stats() {
  const S = {};
  const g = id => S[id] || (S[id] = { id, gols: 0, craques: 0, murchas: 0, pontos: 0, gs: 0, jg: 0, jogos: 0, v: 0, e: 0, d: 0 });
  (D().Historico || []).forEach(h => {
    const s = g(h.jogadorId); s.gols += num(h.gols); s.craques += num(h.craques); s.murchas += num(h.bolasMurchas);
    s.pontos += num(h.pontos); s.gs += num(h.golsSofridos); s.jg += num(h.jogosGoleiro);
  });
  (D().Jogos || []).forEach(j => {
    if (!temResultado(j)) return;
    const gv = num(j.golsVermelho), ga = num(j.golsAzul);
    inscritos(j.id).forEach(i => {
      if (!i.jogadorId || !i.time) return;
      const s = g(i.jogadorId), meu = i.time === 'V' ? gv : ga, deles = i.time === 'V' ? ga : gv;
      s.jogos++; s.gols += num(i.gols);
      if (meu > deles) { s.pontos += 3; s.v++; } else if (meu === deles) { s.pontos += 1; s.e++; } else s.d++;
      if (yes(i.goleiro)) { s.gs += deles; s.jg++; }
    });
    csv(j.craqueIds).forEach(id => g(id).craques++);
    csv(j.murchaIds).forEach(id => g(id).murchas++);
  });
  return S;
}
function ranking(key, filtro) {
  const S = stats();
  let arr = Object.values(S).filter(s => J(s.id) && (filtro ? filtro(s) : key === 'media' ? s.jg > 0 : s[key] > 0));
  if (key === 'media') {
    arr = arr.map(s => Object.assign(s, { media: s.gs / s.jg }));
    arr.sort((a, b) => b.jg - a.jg || a.media - b.media);
    arr.forEach((s, i) => s.pos = i + 1);
    return arr;
  }
  arr.sort((a, b) => b[key] - a[key] || J(a.id).apelido.localeCompare(J(b.id).apelido));
  let pos = 0, last = null;
  arr.forEach(s => { if (s[key] !== last) { pos++; last = s[key]; } s.pos = pos; });
  return arr;
}

/* pendências: o que cada um deve */
function pendencias() {
  const out = [];
  jogosOrd().forEach(j => {
    if (j.status === 'aberta') return;
    inscritos(j.id).forEach(i => { if (!yes(i.pago)) out.push({ tipo: 'jogo', ref: j, i, nome: nomeI(i), jogadorId: i.jogadorId, valor: valorI(i, j) }); });
  });
  (D().Eventos || []).forEach(e => {
    const r = rateio(e);
    (D().EventoParticipantes || []).filter(p => p.eventoId === e.id).forEach(p => {
      const f = faltaEv(e, p, r); if (f <= 0.009) return;
      out.push({ tipo: 'evento', ref: e, i: p, nome: nomeI(p), jogadorId: p.jogadorId, valor: f, complemento: yes(p.pago), rateio: r });
    });
  });
  (D().Cobrancas || []).forEach(c => {
    const falta = num(c.valor) - num(c.pago);
    if (falta > 0) out.push({ tipo: 'cobranca', ref: c, i: c, nome: c.pessoa, jogadorId: matchJog(c.pessoa), valor: falta });
  });
  return out;
}
function matchJog(nome) {
  const n = norm(nome);
  const j = (D().Jogadores || []).find(x => norm(x.apelido) === n || norm(x.nome) === n);
  return j ? j.id : '';
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/* eventos: valor de cada participante (gastos divididos ou valor fixo) */
function rateio(e) {
  const ps = (D().EventoParticipantes || []).filter(p => p.eventoId === e.id);
  const gastos = (D().EventoGastos || []).filter(g => g.eventoId === e.id).reduce((a, g) => a + num(g.valor), 0);
  if (gastos > 0 && ps.length) {
    const fixos = ps.filter(p => !blank(p.valor)), resto = ps.length - fixos.length;
    const sobra = Math.max(0, gastos - fixos.reduce((a, p) => a + num(p.valor), 0));
    const por = resto ? Math.ceil(sobra / resto * 100) / 100 : 0;
    return { auto: true, gastos, n: ps.length, resto, por };
  }
  return { auto: false, gastos, n: ps.length, resto: ps.length, por: num(e.valor) };
}
const devidoEv = (e, p, r) => !blank(p.valor) ? num(p.valor) : (r || rateio(e)).por;
// quem pagou antes desta versão (sem valor gravado) pagou o valor fixo da época
const pagoEvValor = (e, p, r) => !yes(p.pago) ? 0 : !blank(p.valorPago) ? num(p.valorPago) : !blank(p.valor) ? num(p.valor) : num(e.valor) > 0 ? num(e.valor) : devidoEv(e, p, r);
const faltaEv = (e, p, r) => Math.max(0, Math.round((devidoEv(e, p, r) - pagoEvValor(e, p, r)) * 100) / 100);

/* caixa */
function caixa() {
  const base = num(cfg('saldoInicial', 0)), desde = cfg('saldoInicialData', '2000-01-01');
  const itens = [];
  jogosOrd().forEach(j => {
    if (j.data <= desde || j.status === 'aberta') return;
    const paga = inscritos(j.id).filter(i => yes(i.pago)).reduce((s, i) => s + valorI(i, j), 0);
    const arrec = !blank(j.arrecadadoManual) ? num(j.arrecadadoManual) : paga;
    const pendente = yes(j.legado) && blank(j.arrecadadoManual);
    const aReceber = inscritos(j.id).filter(i => !yes(i.pago)).reduce((s, i) => s + valorI(i, j), 0);
    itens.push({ tipo: 'jogo', data: j.data, j, arrec, quadra: num(j.quadra), saldo: pendente ? 0 : arrec - num(j.quadra), pendente, aReceber });
  });
  (D().Caixa || []).forEach(c => itens.push({ tipo: 'lanc', data: c.data, c, saldo: num(c.valor) }));
  itens.sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : (a.tipo === 'jogo' ? -1 : 1));
  let s = base; itens.forEach(it => { s += it.saldo; it.acum = s; });
  return { base, desde, itens, saldo: s, aReceber: itens.reduce((t, it) => t + (it.aReceber || 0), 0) };
}

/* ================= fotos ================= */
function fotoCache() { try { return JSON.parse(localStorage.getItem('efc_fotos') || '{}'); } catch (e) { return {}; } }
async function carregarFotos() {
  const cache = fotoCache();
  const precisa = (D().Jogadores || []).filter(j => j.fotoVer && (!cache[j.id] || cache[j.id].v !== String(j.fotoVer))).map(j => String(j.id));
  for (let k = 0; k < precisa.length; k += 10) {
    try {
      const r = await api('fotos', { ids: precisa.slice(k, k + 10) });
      Object.entries(r.fotos || {}).forEach(([id, url]) => { cache[id] = { v: String(J(id)?.fotoVer), url }; });
    } catch (e) { break; }
  }
  try { localStorage.setItem('efc_fotos', JSON.stringify(cache)); } catch (e) { }
  st.fotos = {}; Object.entries(cache).forEach(([id, c]) => st.fotos[id] = c.url);
}
function av(id, cls = '', nome) {
  const j = id ? J(id) : null;
  const n = nome || j?.apelido || '?';
  const url = id && st.fotos[id];
  if (url) return `<img class="av ${cls}" src="${url}" alt="">`;
  return `<span class="av ${cls}">${esc(n.replace(/[^A-Za-zÀ-ú0-9]/g, '').slice(0, 2).toUpperCase())}</span>`;
}
function reduzirFoto(file) {
  return new Promise((ok, no) => {
    const img = new Image(), fr = new FileReader();
    fr.onload = () => { img.src = fr.result; };
    img.onload = () => {
      const S = 240, c = document.createElement('canvas'); c.width = c.height = S;
      const m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
      c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, S, S);
      ok(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => no(new Error('Não consegui ler a imagem.'));
    fr.readAsDataURL(file);
  });
}

/* ================= interface base ================= */
function toast(m, err) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = m;
  document.body.appendChild(t); setTimeout(() => t.remove(), err ? 4200 : 2200);
}
function modal(titulo, html, onMount) {
  fechar();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="sheet"><div class="hd"><h2>${titulo}</h2><button class="x" data-act="fechar">×</button></div>${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m) fechar(); });
  document.body.appendChild(m); if (onMount) onMount(m); return m;
}
function fechar() { const m = $('#modal'); if (m) m.remove(); }
async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); }
  catch (e) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast('Copiado! É só colar no WhatsApp');
}
function mostrarTexto(titulo, txt) {
  modal(titulo, `<pre class="wa">${esc(txt)}</pre><div class="btns" style="margin-top:12px">
    <button class="btn pri grow" data-act="copiarTxt">Copiar</button>
    <a class="btn" style="text-decoration:none" target="_blank" href="https://wa.me/?text=${encodeURIComponent(txt)}">Abrir WhatsApp</a></div>`,
    m => { m._txt = txt; });
}

const ICON = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  jogo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/></svg>',
  tabela: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  grana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></svg>',
  indic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  eventos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>'
};

function shell() {
  document.body.innerHTML = `${DEMO ? '<div class="demo">MODO DEMONSTRAÇÃO – dados salvos só neste aparelho</div>' : ''}
  <header class="top"><button class="voltar hidden" id="btnVoltar" data-act="voltar" aria-label="Voltar">‹</button><img class="crest" src="icons/escudo.png" alt="">
    <div><div class="t1">Entrevero</div><div class="t2">Futsal Clube</div></div><div class="sp"></div>
    <button class="mebox" data-act="menu"><span class="who"><b id="meNome"></b><small id="mePapel"></small></span><span class="me" id="meBtn"></span></button></header>
  <main id="main"></main>
  <nav class="nav">${['inicio', 'jogo', 'tabela', 'indic', 'grana', 'eventos'].filter(t => t !== 'grana' || admin()).map(t =>
    `<button data-act="tab" data-t="${t}" id="nav-${t}">${ICON[t]}<span>${{ inicio: 'Início', jogo: 'Jogo', tabela: 'Tabela', indic: 'Números', grana: 'Caixa', eventos: 'Eventos' }[t]}</span></button>`).join('')}</nav>`;
}

function render() {
  if (!st.d || !$('#main')) return;
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.t === st.tab));
  $('#meNome').textContent = st.user.apelido; $('#mePapel').textContent = admin() ? 'Administrador' : 'Jogador';
  $('#mePapel').className = admin() ? 'adm' : '';
  $('#meBtn').innerHTML = av(st.user.id, '', st.user.apelido).replace('class="av ', 'style="width:100%;height:100%;border:0" class="av ');
  if (st.tab === 'grana' && !admin()) st.tab = 'inicio';
  setTimeout(atualizarVoltar, 0);
  const V = { inicio: vInicio, jogo: vJogo, tabela: vTabela, grana: vGrana, eventos: vEventos, elenco: vElenco, jogador: vJogador, galeria: vGaleria, indic: vIndic, config: vConfig }[st.tab] || vInicio;
  $('#main').innerHTML = V();
}

/* ================= INÍCIO ================= */
function vInicio() {
  const j = jogoAtual(), me = st.user.id, S = stats(), s = S[me] || {};
  let h = '';
  if (window.EFC_DEMO_GUIA && !lsGet('efc_demo_guia_ok')) h += guiaDemo();
  if (j) {
    const ins = inscritos(j.id), gk = ins.filter(i => yes(i.goleiro)).length, ln = ins.length - gk;
    const eu = ins.find(i => i.jogadorId === me);
    h += `<div class="card hero"><div class="kick">Próximo jogo</div>
      <div class="big" style="margin:4px 0 2px">${DIAS[dt(j.data).getDay()].split('-')[0]} ${fcurta(j.data)}</div>
      <div class="muted">${esc(j.hora)} • Jogador ${brl(j.valorJogador)} • Goleiro ${brl(j.valorGoleiro)}</div>
      <div class="grid2" style="margin:14px 0">
        <div class="stat"><div class="k">Linha</div><div class="v">${ln}<span class="tiny">/${cfg('vagasLinha', 12)}</span></div></div>
        <div class="stat"><div class="k">Goleiros</div><div class="v">${gk}<span class="tiny">/${cfg('vagasGoleiro', 2)}</span></div></div></div>
      ${j.status === 'aberta' ? (eu ? `<div class="row"><span class="chip ok">✓ Você está na lista</span><div class="grow"></div><button class="btn sm ghost" data-act="verJogo" data-id="${j.id}">Ver lista</button></div>`
        : `<div class="btns"><button class="btn pri grow" data-act="entrar" data-id="${j.id}" data-gk="N">Entrar na lista</button><button class="btn" data-act="entrar" data-id="${j.id}" data-gk="S">🥅 Goleiro</button></div>`)
        : `<button class="btn full" data-act="verJogo" data-id="${j.id}">Ver ${ins.some(i => i.time) ? 'times' : 'lista'}</button>`}</div>`;
  }
  // votação pendente
  (D().Jogos || []).filter(g => g.votacao === 'aberta' && inscritos(g.id).some(i => i.jogadorId === me && i.time)
    && !(D().Votos || []).some(v => v.jogoId === g.id && v.eleitorId === me)).forEach(g => {
      h += `<div class="card" style="border-color:var(--or)"><div class="row"><div class="grow"><div class="kick">Votação aberta</div>
      <b>Craque e Bola Murcha de ${fcurta(g.data)}</b></div><button class="btn pri sm" data-act="votar" data-id="${g.id}">Votar</button></div></div>`;
    });
  if ((st.notif === 'desligado' || st.notif === 'ios-instalar') && !lsGet('efc_notif_dica')) {
    h += `<div class="card" style="border-color:var(--or)"><div class="row"><div class="grow"><div class="kick">Novo</div><b>🔔 Receba as notificações do time</b>
      <div class="small muted">Votos, gols, lista aberta e resultado na hora.</div></div></div>
      <div class="btns" style="margin-top:10px"><button class="btn pri sm grow" data-act="notifAbrir">Ativar</button><button class="btn ghost sm" data-act="notifDica">Agora não</button></div></div>`;
  }
  // minhas pendências, separadas por tipo
  h += cardPendencias(me);
  if ((D().Avisos || []).length) {
    h += `<div class="sec"><h2>🔔 Últimos avisos</h2>${D().Avisos.length > 3 ? '<button class="btn sm ghost" data-act="verAvisos">Ver todos</button>' : ''}</div>${listaAvisos(3)}`;
  }
  // último resultado
  const ult = jogosOrd().filter(temResultado).pop();
  if (ult) {
    h += `<div class="sec"><h2>Último resultado</h2><span class="tiny">${fdata(ult.data)}</span></div>
    <div class="card click" data-act="verJogo" data-id="${ult.id}" data-sub="resultado"><div class="score"><span class="V">${ult.golsVermelho}</span><span class="tiny">x</span><span class="A">${ult.golsAzul}</span></div>
    <div class="row" style="justify-content:space-between;font-size:12px;font-weight:700"><span style="color:var(--red)">VERMELHO</span><span style="color:#6aa8ff">AZUL</span></div>
    ${csv(ult.craqueIds).length ? `<div class="small" style="margin-top:8px">⭐ Bola cheia: <b>${csv(ult.craqueIds).map(id => esc(J(id)?.apelido)).join(', ')}</b>${csv(ult.murchaIds).length ? ` &nbsp; 🎈 Bola murcha: <b>${csv(ult.murchaIds).map(id => esc(J(id)?.apelido)).join(', ')}</b>` : ''}</div>` : ''}</div>`;
  }
  // líderes
  const lid = (k, rot, fmt) => { const r = ranking(k)[0]; return r ? `<div class="stat click" data-act="tab" data-t="tabela" data-sub="${k === 'media' ? 'goleiros' : k}"><div class="k">${rot}</div>
     <div class="row" style="margin-top:6px">${av(r.id, 'sm')}<div class="grow ellip"><b>${esc(J(r.id).apelido)}</b><div class="tiny">${fmt(r)}</div></div></div></div>` : ''; };
  h += `<div class="sec"><h2>Líderes</h2><button class="btn sm ghost" data-act="tab" data-t="tabela">Tabela</button></div><div class="grid2">
    ${lid('pontos', '🏆 Pontuação', r => r.pontos + ' pts')}${lid('gols', '⚽ Artilheiro', r => r.gols + ' gols')}
    ${lid('craques', '⭐ Bola cheia', r => r.craques + 'x')}${lid('media', '🥅 Goleiro', r => 'média ' + r.media.toFixed(1).replace('.', ','))}</div>`;
  // minhas estatísticas
  const pos = ranking('pontos').find(r => r.id === me);
  h += `<div class="sec"><h2>Meus números</h2></div><div class="grid2">
    <div class="stat"><div class="k">Pontuação</div><div class="v">${s.pontos || 0}${pos ? `<span class="tiny"> • ${pos.pos}º</span>` : ''}</div></div>
    <div class="stat"><div class="k">Gols</div><div class="v">${s.gols || 0}</div></div>
    <div class="stat"><div class="k">Bola cheia</div><div class="v">${s.craques || 0}</div></div>
    <div class="stat"><div class="k">Bola murcha</div><div class="v">${s.murchas || 0}</div></div></div>
    <div class="btns" style="margin-top:16px"><button class="btn ghost grow" data-act="tab" data-t="elenco">👥 Elenco</button><button class="btn ghost grow" data-act="tab" data-t="galeria">📸 Galeria</button></div>`;
  return h;
}
function cardPendencias(me) {
  const minhas = pendencias().filter(p => p.jogadorId === me);
  if (!minhas.length) return `<div class="card row" style="padding:12px 16px"><span style="font-size:20px">💚</span><div class="grow"><b>Você está em dia</b><div class="tiny">Nenhuma pendência com o time.</div></div></div>`;
  const tot = minhas.reduce((a, p) => a + p.valor, 0);
  const grupos = [['jogo', '⚽ Jogos'], ['evento', '🍖 Eventos'], ['cobranca', '👕 Uniformes e outros']];
  const linha = (t, v, sub) => `<div class="row" style="padding:7px 0;border-top:1px dashed var(--line)"><div class="grow ellip">${t}${sub ? `<div class="tiny">${sub}</div>` : ''}</div><b class="money">${brl(v)}</b></div>`;
  return `<div class="card" style="border-color:rgba(229,72,77,.45)"><div class="row"><div class="grow"><div class="kick" style="color:var(--red)">Minhas pendências</div>
    <div class="big money" style="font-size:28px">${brl(tot)}</div></div><button class="btn sm" data-act="copiarPix">Copiar Pix</button></div>
    ${grupos.map(([k, rot]) => { const ps = minhas.filter(p => p.tipo === k); if (!ps.length) return '';
      return `<div style="margin-top:12px"><div class="row small" style="font-weight:700;margin-bottom:2px"><span class="grow">${rot}</span><span class="money muted">${brl(ps.reduce((a, p) => a + p.valor, 0))}</span></div>
        ${ps.map(p => k === 'jogo' ? linha(`Jogo de ${fdata(p.ref.data)}`, p.valor, yes(p.i.goleiro) ? 'goleiro' : '')
          : k === 'evento' ? linha(esc(p.ref.nome), p.valor, (p.complemento ? 'complemento • ' : '') + fdata(p.ref.data) + (p.rateio && p.rateio.auto && blank(p.i.valor) ? ` • gastos ${brl(p.rateio.gastos)} ÷ ${p.rateio.n}` : ''))
          : linha(esc(p.ref.item), p.valor, num(p.ref.pago) > 0 ? `já pagou ${brl(p.ref.pago)} de ${brl(p.ref.valor)}` : esc(p.ref.categoria))).join('')}</div>`; }).join('')}
    <div class="tiny" style="margin-top:12px">Pix: <b style="user-select:all">${esc(cfg('pix'))}</b> • depois de pagar, um administrador marca como pago.</div></div>`;
}
function rotuloPend(p) {
  if (p.tipo === 'jogo') return `Jogo ${fcurta(p.ref.data)} ${brl(p.valor)}`;
  if (p.tipo === 'evento') return `${p.ref.nome} ${brl(p.valor)}`;
  return `${p.ref.item} ${brl(p.valor)}`;
}

/* ================= JOGO ================= */
function vJogo() {
  const todos = jogosOrd();
  if (!st.jogoId || !jogo(st.jogoId)) st.jogoId = jogoAtual()?.id;
  const j = jogo(st.jogoId);
  const recentes = ativos().slice(-6).reverse();
  if (j && yes(j.arquivado)) recentes.unshift(j);
  let h = `<div class="row" style="overflow-x:auto;gap:8px;margin-bottom:14px;padding-bottom:2px">
    ${admin() ? `<button class="btn sm pri" data-act="novoJogo">+ Nova lista</button>` : ''}
    ${recentes.map(g => `<button class="chip ${g.id === st.jogoId ? 'or' : ''}" style="border:0;padding:8px 12px;white-space:nowrap" data-act="selJogo" data-id="${g.id}">${fcurta(g.data)}</button>`).join('')}</div>`;
  if (!j) return h + `<div class="card muted">Nenhum jogo ainda. ${admin() ? 'Toque em “+ Nova lista”.' : ''}</div>`;
  const stLbl = { aberta: ['or', 'Lista aberta'], fechada: ['blue', 'Lista fechada'], encerrada: ['', 'Encerrado'] }[j.status] || ['', j.status];
  h += `<div class="card hero"><div class="row"><div class="grow"><div class="kick">${DIAS[dt(j.data).getDay()]}${yes(j.arquivado) ? ' • 🗄️ Arquivado' : ''}</div>
    <div class="big">${fdata(j.data)}</div><div class="muted small">${esc(j.hora)} • quadra ${brl(j.quadra)}</div></div>
    <div style="text-align:right"><span class="chip ${stLbl[0]}">${stLbl[1]}</span>${admin() ? `<div style="margin-top:8px"><button class="btn sm ghost" data-act="editJogo">Editar</button></div>` : ''}</div></div>
    ${temResultado(j) ? `<div class="score" style="margin-top:10px"><span class="V">${j.golsVermelho}</span><span class="tiny">x</span><span class="A">${j.golsAzul}</span></div>` : ''}
    ${j.obs ? `<div class="small" style="margin-top:8px;color:var(--warn)">${esc(j.obs)}</div>` : ''}</div>`;
  const tabs = [['lista', 'Lista'], ['times', 'Times'], ['resultado', 'Resultado'], ['votacao', 'Votação']];
  h += `<div class="seg">${tabs.map(([k, l]) => `<button class="${st.jogoTab === k ? 'on' : ''}" data-act="jogoTab" data-t="${k}">${l}</button>`).join('')}</div>`;
  h += ({ lista: jLista, times: jTimes, resultado: jResultado, votacao: jVotacao }[st.jogoTab] || jLista)(j);
  return h;
}

function divideLista(j) {
  const ins = inscritos(j.id), vg = num(cfg('vagasGoleiro', 2)), vl = num(cfg('vagasLinha', 12));
  const gk = ins.filter(i => yes(i.goleiro)), ln = ins.filter(i => !yes(i.goleiro));
  return { gk: gk.slice(0, vg), ln: ln.slice(0, vl), sup: [...gk.slice(vg), ...ln.slice(vl)], vg, vl };
}
function linhaInsc(i, n, j) {
  const pago = yes(i.pago), me = i.jogadorId === st.user.id;
  return `<div class="li"><span class="n">${n}</span>${av(i.jogadorId, '', nomeI(i))}
    <div class="grow ellip"><b>${yes(i.goleiro) ? '🥅 ' : ''}${esc(nomeI(i))}</b>${me ? ' <span class="chip or">você</span>' : ''}
    ${!blank(i.valor) ? `<div class="tiny">valor ${brl(i.valor)}</div>` : ''}</div>
    ${admin() ? `<button class="paybtn" data-act="pago" data-id="${i.id}" title="pago">${pago ? '✅' : '❌'}</button>
      <button class="x" data-act="tirar" data-id="${i.id}" style="width:28px;height:28px;font-size:14px">×</button>`
      : (pago ? '<span class="chip ok">pago</span>' : (j.status !== 'aberta' ? '<span class="chip no">pendente</span>' : ''))}</div>`;
}
function jLista(j) {
  const { gk, ln, sup, vg, vl } = divideLista(j);
  const me = inscritos(j.id).find(i => i.jogadorId === st.user.id);
  let h = '', n = 0;
  if (j.status === 'aberta') {
    h += me ? `<div class="btns" style="margin-bottom:14px"><button class="btn danger grow" data-act="tirar" data-id="${me.id}">Sair da lista</button></div>`
      : `<div class="btns" style="margin-bottom:14px"><button class="btn pri grow" data-act="entrar" data-id="${j.id}" data-gk="N">Entrar na lista</button><button class="btn" data-act="entrar" data-id="${j.id}" data-gk="S">🥅 Goleiro</button></div>`;
  }
  h += `<div class="list">`;
  for (let k = 0; k < vg; k++) { n++; h += gk[k] ? linhaInsc(gk[k], n, j) : `<div class="li empty"><span class="n">${n}</span>🥅 vaga de goleiro</div>`; }
  for (let k = 0; k < vl; k++) { n++; h += ln[k] ? linhaInsc(ln[k], n, j) : `<div class="li empty"><span class="n">${n}</span>vaga</div>`; }
  h += `</div>`;
  if (sup.length) { h += `<div class="sec"><h2>Suplentes</h2></div><div class="list">${sup.map(i => linhaInsc(i, ++n, j)).join('')}</div>`; }
  h += `<div class="btns">${admin() ? `<button class="btn" data-act="addInsc">+ Adicionar</button>` : ''}
    <button class="btn pri grow" data-act="textoLista">📲 Texto da lista</button></div>`;
  if (admin()) {
    h += `<div class="btns" style="margin-top:8px">${j.status === 'aberta' ? `<button class="btn ghost grow" data-act="statusJogo" data-s="fechada">Fechar lista</button>`
      : `<button class="btn ghost grow" data-act="statusJogo" data-s="aberta">Reabrir lista</button>`}</div>`;
  }
  return h;
}

/* ---------- times equilibrados ---------- */
function sugestoes(j) {
  const { gk, ln } = divideLista(j), S = stats();
  const inf = i => { const p = J(i.jogadorId) || {}; const s = S[i.jogadorId] || {};
    return { id: i.id, nota: num(p.nota) || 1, peso: num(p.peso) || 80, pts: s.pontos || 0, gols: s.gols || 0 }; };
  const L = ln.map(inf), G = gk.map(inf), n = L.length, k = Math.floor(n / 2);
  const topP = [...L].sort((a, b) => b.pts - a.pts).slice(0, 2).map(x => x.id);
  const topG = [...L].sort((a, b) => b.gols - a.gols).slice(0, 2).map(x => x.id);
  const gkOpts = G.length >= 2 ? [[G[0], G[1]], [G[1], G[0]]] : G.length === 1 ? [[G[0], null]] : [[null, null]];
  const res = [];
  const comb = (start, sel) => {
    if (sel.length === k) {
      if (n > 1 && sel[0] !== 0) return; // evita espelho: jogador 0 sempre no Vermelho
      const V = sel.map(x => L[x]), A = L.filter((_, x) => !sel.includes(x));
      gkOpts.forEach(([gv, ga]) => {
        const sum = (arr, f) => arr.reduce((t, x) => t + x[f], 0);
        const nv = sum(V, 'nota') + (gv ? gv.nota : 0), na = sum(A, 'nota') + (ga ? ga.nota : 0);
        const pv = sum(V, 'peso'), pa = sum(A, 'peso');
        const sameP = topP.length === 2 && V.some(x => x.id === topP[0]) === V.some(x => x.id === topP[1]);
        const sameG = topG.length === 2 && V.some(x => x.id === topG[0]) === V.some(x => x.id === topG[1]);
        const custo = Math.abs(nv - na) * 10 + Math.abs(pv - pa) / 5 + (sameP ? 4 : 0) + (sameG ? 3 : 0)
          + Math.abs(sum(V, 'gols') - sum(A, 'gols')) / 40 + Math.abs(sum(V, 'pts') - sum(A, 'pts')) / 40;
        res.push({ custo, V: [gv, ...V].filter(Boolean).map(x => x.id), A: [ga, ...A].filter(Boolean).map(x => x.id) });
      });
      return;
    }
    for (let x = start; x < n; x++) { sel.push(x); comb(x + 1, sel); sel.pop(); }
  };
  comb(0, []);
  res.sort((a, b) => a.custo - b.custo);
  return res.slice(0, 30);
}
function resumoTime(ids) {
  const ins = ids.map(id => (D().Inscricoes || []).find(i => i.id === id)).filter(Boolean);
  const lin = ins.filter(i => !yes(i.goleiro)), gk = ins.filter(i => yes(i.goleiro));
  const nota = ins.reduce((t, i) => t + num(J(i.jogadorId)?.nota || 1), 0), peso = lin.reduce((t, i) => t + num(J(i.jogadorId)?.peso || 80), 0);
  return { ins, lin, gk, nota, peso };
}
function jTimes(j) {
  const r = st.rascunho && st.rascunho.jogoId === j.id ? st.rascunho : null;
  const ins = inscritos(j.id);
  let V, A;
  if (r) { V = r.V; A = r.A; }
  else { V = ins.filter(i => i.time === 'V').map(i => i.id); A = ins.filter(i => i.time === 'A').map(i => i.id); }
  const ord = ids => [...ids].sort((a, b) => { const ia = ins.find(i => i.id === a), ib = ins.find(i => i.id === b); return (yes(ib?.goleiro) - yes(ia?.goleiro)); });
  V = ord(V); A = ord(A);
  let h = '';
  if (!V.length && !A.length && !r) {
    h += `<div class="card muted">Os times ainda não foram montados.</div>`;
    if (admin()) h += `<button class="btn pri full" data-act="sortear">⚖️ Montar times equilibrados</button>`;
    return h;
  }
  const col = (t, ids) => {
    const rs = resumoTime(ids);
    return `<div class="team ${t}"><h3>${t === 'V' ? '🔴 Vermelho' : '🔵 Azul'}</h3>
      ${ids.map(id => { const i = ins.find(x => x.id === id); if (!i) return ''; return `<div class="tp" ${r ? `data-act="mover" data-id="${id}"` : ''}>${av(i.jogadorId, 'sm', nomeI(i))}<span class="ellip">${yes(i.goleiro) ? '🥅 ' : ''}${esc(nomeI(i))}</span></div>`; }).join('')}
      ${admin() ? `<div class="sum">Nota ${rs.nota.toLocaleString('pt-BR')} • Linha ${rs.peso} kg</div>` : ''}</div>`;
  };
  if (r) h += `<div class="small muted" style="margin-bottom:10px">Toque em um jogador para trocá-lo de time.</div>`;
  h += `<div class="teams">${col('V', V)}${col('A', A)}</div>`;
  if (r) {
    h += `<div class="btns" style="margin-top:14px"><button class="btn ghost" data-act="outraSug">🔄 Outra opção</button>
      <button class="btn pri grow" data-act="salvarTimes">Salvar times</button></div>
      <button class="btn ghost full" style="margin-top:8px" data-act="cancelarTimes">Cancelar</button>`;
  } else {
    h += `<div class="btns" style="margin-top:14px"><button class="btn pri grow" data-act="textoTimes">📲 Texto da escalação</button>
      ${admin() && j.status !== 'encerrada' ? `<button class="btn ghost" data-act="sortear">Refazer</button><button class="btn ghost" data-act="editarTimes">Ajustar</button>` : ''}</div>`;
  }
  return h;
}
function textoTimes(j) {
  const ins = inscritos(j.id);
  const lado = t => ins.filter(i => i.time === t).sort((a, b) => yes(b.goleiro) - yes(a.goleiro)).map(i => (yes(i.goleiro) ? '🥅 ' : '') + nomeI(i)).join('\n');
  return preencher('escalacao', { DATA: fdata(j.data), TIME_VERMELHO: lado('V'), TIME_AZUL: lado('A'), ANALISE: analise(j) });
}
function analise(j) {
  const S = stats(), ins = inscritos(j.id).filter(i => i.jogadorId);
  const t = x => ins.filter(i => i.time === x);
  const nome = id => J(id)?.apelido;
  const soma = (arr, f) => arr.reduce((a, i) => a + ((S[i.jogadorId] || {})[f] || 0), 0);
  const top = (arr, f) => [...arr].sort((a, b) => ((S[b.jogadorId] || {})[f] || 0) - ((S[a.jogadorId] || {})[f] || 0))[0];
  const L = [];
  const tv = top(t('V'), 'gols'), ta = top(t('A'), 'gols');
  L.push(`⚽ *Artilharia:* o Vermelho soma ${soma(t('V'), 'gols')} gols na temporada${tv ? `, com ${nome(tv.jogadorId)} (${S[tv.jogadorId]?.gols || 0}) puxando o ataque` : ''}. O Azul soma ${soma(t('A'), 'gols')}${ta ? `, com ${nome(ta.jogadorId)} (${S[ta.jogadorId]?.gols || 0})` : ''}.`);
  const gv = t('V').find(i => yes(i.goleiro)), ga = t('A').find(i => yes(i.goleiro));
  const md = i => { const s = S[i.jogadorId] || {}; return s.jg ? `média ${(s.gs / s.jg).toFixed(1).replace('.', ',')} em ${s.jg} jogos` : 'estreando na tabela'; };
  if (gv && ga) L.push(`🥅 *Duelo no gol:* ${nome(gv.jogadorId)} (${md(gv)}) x ${nome(ga.jogadorId)} (${md(ga)}).`);
  L.push(`🏆 *Pontuação geral:* Vermelho soma ${soma(t('V'), 'pontos')} pts e Azul ${soma(t('A'), 'pontos')} pts na tabela.`);
  const rk = ranking('pontos').filter(r => ins.some(i => i.jogadorId === r.id && i.time));
  const duelos = [];
  for (let a = 0; a < rk.length - 1 && duelos.length < 2; a++) {
    const ia = ins.find(i => i.jogadorId === rk[a].id), ib = ins.find(i => i.jogadorId === rk[a + 1].id);
    if (ia.time !== ib.time) { duelos.push(`${nome(rk[a].id)} x ${nome(rk[a + 1].id)} (${rk[a].pos}º e ${rk[a + 1].pos}º da pontuação)`); a++; }
  }
  if (duelos.length) L.push(`⚔️ *Duelos da rodada:* ${duelos.join('; ')}.`);
  return `${modelo('analise')}\n\n${L.join('\n\n')}`;
}

/* ---------- resultado ---------- */
function jResultado(j) {
  const ins = inscritos(j.id).filter(i => i.time);
  if (!ins.length) return `<div class="card muted">Monte os times antes de lançar o resultado.</div>`;
  if (!admin()) {
    const eu = ins.find(i => i.jogadorId === st.user.id);
    let h = '';
    if (eu && j.status !== 'aberta' && j.votacao !== 'fechada') {
      const g = st.meusGols && st.meusGols.id === eu.id ? st.meusGols.v : num(eu.gols);
      h += `<div class="card"><div class="kick">Seus gols neste jogo</div><div class="row" style="margin-top:10px">
        <div class="step"><button data-act="meuGol" data-id="${eu.id}" data-d="-1">−</button><b>${g}</b><button data-act="meuGol" data-id="${eu.id}" data-d="1">+</button></div>
        <div class="grow"></div><button class="btn pri sm" data-act="salvarMeuGol" data-id="${eu.id}" ${g === num(eu.gols) ? 'disabled' : ''}>Salvar</button></div>
        <div class="tiny" style="margin-top:8px">O time todo recebe o aviso. Dá para corrigir até a votação ser encerrada.</div></div>`;
    }
    if (!temResultado(j)) h += `<div class="small muted" style="margin-bottom:8px">Placar ainda não lançado pelo administrador.</div>`;
    const gols = ins.filter(i => num(i.gols) > 0).sort((a, b) => num(b.gols) - num(a.gols));
    return h + `<div class="sec" style="margin-top:6px"><h3>⚽ Gols registrados</h3></div><div class="list">${gols.map(i => `<div class="li">${av(i.jogadorId, '', nomeI(i))}<div class="grow"><b>${esc(nomeI(i))}</b> <span class="tiny">${i.time === 'V' ? '🔴' : '🔵'}</span></div><b class="disp">${i.gols} ⚽</b></div>`).join('') || '<div class="li empty">Sem gols registrados</div>'}</div>`;
  }
  const stp = (act, id, v, extra = '') => `<div class="step"><button data-act="${act}" data-id="${id}" data-d="-1" ${extra}>−</button><b>${v}</b><button data-act="${act}" data-id="${id}" data-d="1" ${extra}>+</button></div>`;
  const r = st.res && st.res.jogoId === j.id ? st.res : (st.res = {
    jogoId: j.id, V: blank(j.golsVermelho) ? 0 : num(j.golsVermelho), A: blank(j.golsAzul) ? 0 : num(j.golsAzul),
    g: Object.fromEntries(ins.map(i => [i.id, num(i.gols)]))
  });
  const lado = t => ins.filter(i => i.time === t).map(i => `<div class="li">${av(i.jogadorId, 'sm', nomeI(i))}<div class="grow ellip">${yes(i.goleiro) ? '🥅 ' : ''}${esc(nomeI(i))}</div>${stp('golJ', i.id, r.g[i.id] || 0)}</div>`).join('');
  const sV = ins.filter(i => i.time === 'V').reduce((a, i) => a + (r.g[i.id] || 0), 0), sA = ins.filter(i => i.time === 'A').reduce((a, i) => a + (r.g[i.id] || 0), 0);
  return `<div class="card"><div class="row" style="justify-content:space-around">
      <div style="text-align:center"><div class="kick" style="color:var(--red)">Vermelho</div>${stp('golT', 'V', r.V)}</div>
      <div class="disp" style="font-size:22px">x</div>
      <div style="text-align:center"><div class="kick" style="color:#6aa8ff">Azul</div>${stp('golT', 'A', r.A)}</div></div></div>
    <div class="sec"><h3>🔴 Gols do Vermelho <span class="tiny">(${sV})</span></h3></div><div class="list">${lado('V')}</div>
    <div class="sec"><h3>🔵 Gols do Azul <span class="tiny">(${sA})</span></h3></div><div class="list">${lado('A')}</div>
    ${(sV !== r.V || sA !== r.A) ? `<div class="small" style="color:var(--warn);margin-bottom:10px">A soma dos gols individuais não bate com o placar (pode ser gol contra).</div>` : ''}
    <button class="btn pri full" data-act="salvarRes">Salvar resultado${j.votacao ? '' : ' e abrir votação'}</button>`;
}

/* ---------- votação ---------- */
function jVotacao(j) {
  const ins = inscritos(j.id).filter(i => i.time && i.jogadorId);
  const me = st.user.id, jogou = ins.some(i => i.jogadorId === me);
  const meuVoto = (D().Votos || []).find(v => v.jogoId === j.id && v.eleitorId === me);
  let h = '';
  if (j.votacao === 'fechada' || csv(j.craqueIds).length) {
    h += `<div class="grid2"><div class="stat"><div class="k">⭐ Bola cheia</div>${csv(j.craqueIds).map(id => `<div class="row" style="margin-top:8px">${av(id, 'sm')}<b>${esc(J(id)?.apelido)}</b></div>`).join('') || '<div class="muted">—</div>'}</div>
      <div class="stat"><div class="k">🎈 Bola murcha</div>${csv(j.murchaIds).map(id => `<div class="row" style="margin-top:8px">${av(id, 'sm')}<b>${esc(J(id)?.apelido)}</b></div>`).join('') || '<div class="muted">—</div>'}</div></div>`;
  }
  const votos = (D().Votos || []).filter(v => v.jogoId === j.id);
  if (j.votacao === 'aberta') {
    if (jogou && !meuVoto) h += `<button class="btn pri full" style="margin:12px 0" data-act="votar" data-id="${j.id}">🗳️ Votar agora</button>`;
    else if (meuVoto) h += `<div class="card"><span class="chip ok">✓ Você votou</span>
      <div class="small" style="margin:8px 0 12px">⭐ ${esc(J(meuVoto.craqueId)?.apelido || '—')} &nbsp; 🎈 ${esc(J(meuVoto.murchaId)?.apelido || '—')}</div>
      <div class="btns"><button class="btn sm grow" data-act="votar" data-id="${j.id}">✎ Mudar voto</button><button class="btn sm danger" data-act="retirarVoto" data-id="${meuVoto.id}">Retirar voto</button></div></div>`;
    else h += `<div class="card muted">Votação aberta para quem jogou.</div>`;
  }
  if (j.votacao) {
    const cont = f => { const c = {}; votos.forEach(v => { if (v[f]) c[v[f]] = (c[v[f]] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
    const bloco = (t, arr) => `<div class="sec"><h3>${t}</h3></div><div class="list">${arr.map(([id, n]) => `<div class="li">${av(id, 'sm')}<div class="grow">${esc(J(id)?.apelido)}</div><b>${n} voto${n > 1 ? 's' : ''}</b></div>`).join('') || '<div class="li empty">Sem votos</div>'}</div>`;
    h += `<div class="small muted" style="margin-top:6px">${votos.length} de ${ins.length} votaram</div>${bloco('⭐ Bola cheia (craque)', cont('craqueId'))}${bloco('🎈 Bola murcha', cont('murchaId'))}
      <div class="sec"><h3>Quem votou em quem</h3></div><div class="list">${votos.map(v => `<div class="li">${av(v.eleitorId, 'sm')}<div class="grow ellip"><b>${esc(J(v.eleitorId)?.apelido)}</b>
        <div class="tiny">⭐ ${esc(J(v.craqueId)?.apelido || '—')} • 🎈 ${esc(J(v.murchaId)?.apelido || '—')}</div></div></div>`).join('') || '<div class="li empty">Ninguém votou ainda</div>'}</div>
      <button class="btn ghost full" style="margin-bottom:8px" data-act="textoVot">📲 Texto da votação</button>`;
    if (admin() && j.votacao === 'aberta') h += `<button class="btn pri full" data-act="fecharVot">Encerrar votação</button>`;
  } else if (!j.votacao && !csv(j.craqueIds).length) {
    h += `<div class="card muted">A votação abre quando o resultado for lançado.</div>`;
  }
  if (admin() && temResultado(j)) h += `<button class="btn ghost full" style="margin-top:8px" data-act="definirCraque">Definir manualmente</button>`;
  return h;
}

/* ================= MODELOS DE TEXTO (editáveis) ================= */
const MODELOS = {
  lista: { nome: 'Lista do jogo', vars: ['DIA_SEMANA', 'HORA', 'DATA', 'LISTA', 'VALOR_JOGADOR', 'VALOR_GOLEIRO', 'PIX'],
    padrao: 'JOGO  {DIA_SEMANA} {HORA}\n*({DATA})*\n⚽⚽⚽⚽⚽⚽⚽\n{LISTA}\n\n*Jogador: R${VALOR_JOGADOR}*\n*Goleiro: R${VALOR_GOLEIRO}*\n\n*Pix:*\n{PIX}' },
  pendencias: { nome: 'Pendências de um jogo', vars: ['DATA', 'LISTA', 'VALOR'],
    padrao: '*PENDÊNCIAS ({DATA})*\n⚽⚽⚽⚽⚽⚽⚽\n{LISTA}\n{VALOR}' },
  separador: { nome: 'Separador entre blocos', vars: [], padrao: '----------------------------------------' },
  escalacao: { nome: 'Escalação', vars: ['DATA', 'TIME_VERMELHO', 'TIME_AZUL', 'ANALISE'],
    padrao: '🔴 *TIME VERMELHO*\n\n{TIME_VERMELHO}\n\n🔵 *TIME AZUL*\n\n{TIME_AZUL}\n\n{ANALISE}' },
  analise: { nome: 'Título da análise', vars: [], padrao: '📊 *ANÁLISE DA RODADA*' },
  evento: { nome: 'Evento', vars: ['NOME', 'EMOJI', 'DATA', 'LISTA', 'VALOR', 'PIX'],
    padrao: '*{NOME}* {EMOJI}\n*({DATA})*\n{LISTA}\n*R${VALOR}*\n\n*Pix:*\n{PIX}' },
  votacao: { nome: 'Resultado da votação', vars: ['DATA', 'BOLA_CHEIA', 'BOLA_MURCHA', 'VOTOS'],
    padrao: '🗳️ *VOTAÇÃO {DATA}*\n\n⭐ *BOLA CHEIA*\n{BOLA_CHEIA}\n\n🎈 *BOLA MURCHA*\n{BOLA_MURCHA}\n\n*Votos:*\n{VOTOS}' },
  tabela: { nome: 'Tabelas da rodada', vars: ['RODADA', 'DATA', 'PONTUACAO', 'ARTILHARIA', 'BOLA_CHEIA', 'GOLEIROS', 'BOLA_MURCHA'],
    padrao: '*RODADA-{RODADA} • {DATA}*\n\n🏆 *PONTUAÇÃO GERAL*\n{PONTUACAO}\n\n⚽ *ARTILHARIA*\n{ARTILHARIA}\n\n⭐ *BOLA CHEIA*\n{BOLA_CHEIA}\n\n🥅 *GOLEIRO MENOS VAZADO*\n{GOLEIROS}\n\n🎈 *BOLA MURCHA*\n{BOLA_MURCHA}' },
  acesso: { nome: 'Mensagem de acesso', vars: ['NOME', 'USUARIO', 'SENHA', 'LINK'],
    padrao: '⚽ *Entrevero Futsal Clube – App*\n\nOlá, {NOME}! Seu acesso:\nUsuário: *{USUARIO}*\nSenha temporária: *{SENHA}*\n\nNo primeiro acesso o app pede para você criar sua senha.\n{LINK}' }
};
const modelo = k => { const v = cfg('tpl_' + k, ''); return blank(v) ? MODELOS[k].padrao : String(v); };
const preencher = (k, vars) => modelo(k).replace(/\{([A-Z_]+)\}/g, (m, n) => n in vars ? String(vars[n]) : m);
const SEP = () => '\n\n' + modelo('separador') + '\n\n';

/* ---------- textos ---------- */
function textoLista(j, comPend) {
  const { gk, ln, sup, vg, vl } = divideLista(j);
  let n = 0, L = [];
  const lin = i => nomeI(i) + (yes(i.pago) ? ' ✅' : '');
  for (let k = 0; k < vg; k++) L.push(`${++n}. 🥅 ${gk[k] ? lin(gk[k]) : ''}`);
  for (let k = 0; k < vl; k++) L.push(`${++n}. ${ln[k] ? lin(ln[k]) : ''}`);
  if (sup.length) { L.push('', 'SUPLENTES'); sup.forEach(i => L.push(`${++n}. ${yes(i.goleiro) ? '🥅 ' : ''}${lin(i)}`)); }
  const corpo = preencher('lista', { DIA_SEMANA: DIAS[dt(j.data).getDay()], HORA: j.hora, DATA: fdata(j.data), LISTA: L.join('\n'),
    VALOR_JOGADOR: brl0(j.valorJogador), VALOR_GOLEIRO: brl0(j.valorGoleiro), PIX: cfg('pix') });
  const p = comPend ? textoPendencias() : '';
  return p ? p + SEP() + corpo : corpo;
}
function textoPendencias() {
  const P = pendencias(), blocos = [];
  jogosOrd().forEach(j => {
    const ps = P.filter(p => p.tipo === 'jogo' && p.ref.id === j.id); if (!ps.length) return;
    const base = i => yes(i.goleiro) ? num(j.valorGoleiro) : num(j.valorJogador);
    const lista = ps.map((p, k) => { const extra = p.valor - base(p.i); return `${k + 1}. ${yes(p.i.goleiro) ? '🥅 ' : ''}${p.nome}${extra > 0 ? ` (+${brl0(extra).replace(',00', '')})` : ''} ❌`; }).join('\n');
    const tipos = new Set(ps.map(p => yes(p.i.goleiro)));
    const valor = tipos.size > 1 ? `*Jogador: R$${brl0(j.valorJogador)} | Goleiro: R$${brl0(j.valorGoleiro)}*` : `*R$${brl0(tipos.has(true) ? j.valorGoleiro : j.valorJogador)}*`;
    blocos.push(preencher('pendencias', { DATA: fdata(j.data), LISTA: lista, VALOR: valor }));
  });
  (D().Eventos || []).forEach(e => {
    const ps = P.filter(p => p.tipo === 'evento' && p.ref.id === e.id); if (!ps.length) return;
    blocos.push(`${e.nome}: ${emojiEv(e)}\n${ps.map((p, k) => `${k + 1}. ${p.nome}${p.complemento ? ` (falta R$${brl0(p.valor)})` : ''} ❌`).join('\n')}\n*R$${brl0(rateio(e).por)}*`);
  });
  return blocos.join(SEP());
}
const emojiEv = e => /churras/i.test(e.nome) ? '🍖🍖🍖🍖🍖' : /festa|arraial|confra/i.test(e.nome) ? '🎉🎉🎉🎉🎉' : '📅📅📅📅📅';

/* ================= TABELA ================= */
function vTabela() {
  const tabs = [['pontos', '🏆 Pontos'], ['gols', '⚽ Artilharia'], ['craques', '⭐ B. cheia'], ['murchas', '🎈 B. murcha'], ['goleiros', '🥅 Goleiros']];
  let h = `<div class="seg">${tabs.map(([k, l]) => `<button class="${st.tabTab === k ? 'on' : ''}" data-act="tabTab" data-t="${k}">${l}</button>`).join('')}</div>`;
  const me = st.user.id;
  if (st.tabTab === 'goleiros') {
    const r = ranking('media');
    h += `<div class="list">${r.map(s => `<div data-act="verJog" data-id="${s.id}" style="cursor:pointer" class="rk ${s.pos <= 3 ? 'top' + s.pos : ''} ${s.id === me ? 'me' : ''}"><span class="p">${s.pos}º</span>${av(s.id, 'sm')}
      <div class="grow"><b>${esc(J(s.id).apelido)}</b><div class="sub">${s.gs} gols sofridos • ${s.jg} jogos</div></div><div class="v">${s.media.toFixed(1).replace('.', ',')}</div></div>`).join('')}</div>
      <div class="tiny">Ordem por jogos no gol; número = média de gols sofridos por jogo.</div>`;
  } else {
    const r = ranking(st.tabTab);
    const suf = { pontos: 'pts', gols: '', craques: 'x', murchas: 'x' }[st.tabTab];
    h += r.length ? `<div class="list">${r.map(s => `<div data-act="verJog" data-id="${s.id}" style="cursor:pointer" class="rk ${s.pos <= 3 ? 'top' + s.pos : ''} ${s.id === me ? 'me' : ''}"><span class="p">${s.pos}º</span>${av(s.id, 'sm')}
      <div class="grow"><b>${esc(J(s.id).apelido)}</b>${st.tabTab === 'pontos' && s.jogos ? `<div class="sub">${s.v}V ${s.e}E ${s.d}D no app</div>` : ''}</div><div class="v">${s[st.tabTab]}<span class="tiny"> ${suf}</span></div></div>`).join('')}</div>`
      : `<div class="card muted">Ninguém ainda nesta tabela.</div>`;
    if (st.tabTab === 'pontos') h += `<div class="tiny">Vitória = 3 • Empate = 1 • Derrota = 0. Inclui as tabelas até a Rodada 34.</div>`;
  }
  h += `<button class="btn ghost full" style="margin-top:14px" data-act="textoTabela">📲 Compartilhar tabelas</button>`;
  return h;
}
function rodadaAtual() { return num(cfg('rodadaBase', 34)) + jogosOrd().filter(temResultado).length; }
function textoTabela() {
  const lin = (r, f) => r.slice(0, 10).map(s => `${s.pos}º ${J(s.id).apelido} – ${f(s)}`).join('\n') || '—';
  return preencher('tabela', { RODADA: rodadaAtual(), DATA: fdata(jogosOrd().filter(temResultado).pop()?.data || hoje()),
    PONTUACAO: lin(ranking('pontos'), s => s.pontos), ARTILHARIA: lin(ranking('gols'), s => s.gols), BOLA_CHEIA: lin(ranking('craques'), s => s.craques),
    GOLEIROS: ranking('media').slice(0, 6).map(s => `${s.pos}º ${J(s.id).apelido} – ${s.gs} em ${s.jg} jogos (${s.media.toFixed(1).replace('.', ',')})`).join('\n') || '—',
    BOLA_MURCHA: lin(ranking('murchas'), s => s.murchas) });
}

/* ================= CAIXA / GRANA ================= */
function vGrana() {
  const tabs = [['caixa', 'Caixa'], ['pend', 'Pendências'], ['unif', 'Uniformes'], ['patro', 'Patrocínios']];
  let h = `<div class="seg">${tabs.map(([k, l]) => `<button class="${st.granaTab === k ? 'on' : ''}" data-act="granaTab" data-t="${k}">${l}</button>`).join('')}</div>`;
  if (!admin()) h += `<div class="tiny" style="margin:-6px 0 10px">Somente os administradores alteram a parte financeira.</div>`;
  return h + ({ caixa: gCaixa, pend: gPend, unif: gUnif, patro: gPatro }[st.granaTab] || gCaixa)();
}
function gCaixa() {
  const c = caixa();
  let h = `<div class="card hero"><div class="kick">Caixa do time</div><div class="big money">${brl(c.saldo)}</div>
    <div class="small muted">${c.aReceber > 0 ? `+ ${brl(c.aReceber)} a receber dos jogos` : 'Tudo recebido dos jogos'}</div></div>
    <div class="list"><div class="li"><div class="grow"><b>Saldo em ${fdata(c.desde)}</b></div><b class="money">${brl(c.base)}</b>${admin() ? `<button class="btn sm ghost" data-act="editSaldo">✎</button>` : ''}</div>`;
  c.itens.forEach(it => {
    if (it.tipo === 'jogo') {
      h += `<div class="li ${admin() ? 'click' : ''}" ${admin() ? `data-act="editArrec" data-id="${it.j.id}"` : ''}><div class="grow"><b>Jogo ${fcurta(it.data)}</b>
        <div class="tiny">${it.pendente ? '⚠️ informe o valor arrecadado' : `Arrecadado ${brl(it.arrec)} • Quadra ${brl(it.quadra)}`}</div></div>
        <div style="text-align:right"><b class="money ${it.saldo >= 0 ? 'pos' : 'neg'}">${it.pendente ? '—' : (it.saldo >= 0 ? '+' : '') + brl0(it.saldo)}</b><div class="tiny money">${brl(it.acum)}</div></div></div>`;
    } else {
      h += `<div class="li ${admin() ? 'click' : ''}" ${admin() ? `data-act="editLanc" data-id="${it.c.id}"` : ''}><div class="grow"><b>${esc(it.c.descricao)}</b><div class="tiny">${fdata(it.data)}</div></div>
        <div style="text-align:right"><b class="money ${it.saldo >= 0 ? 'pos' : 'neg'}">${(it.saldo >= 0 ? '+' : '') + brl0(it.saldo)}</b><div class="tiny money">${brl(it.acum)}</div></div></div>`;
    }
  });
  h += `</div><div class="btns">${admin() ? `<button class="btn" data-act="editLanc">+ Lançamento</button>` : ''}<button class="btn pri grow" data-act="textoBalanco">📲 Texto do balanço</button></div>
    <div class="tiny" style="margin-top:10px">Cada jogo entra no caixa quando a lista é fechada: soma dos pagamentos marcados ✅ menos a quadra.</div>`;
  return h;
}
function textoBalanco() {
  const c = caixa(), m = dt(c.itens.length ? c.itens[c.itens.length - 1].data : hoje());
  let t = `*Balanço ${MESES[m.getMonth()]}-${m.getFullYear()}*\n\n`;
  c.itens.filter(i => i.tipo === 'jogo').forEach(i => {
    t += `* ${fcurta(i.data)}\nQuadra=${brl0(i.quadra)}\nArrecadado=${i.pendente ? 'XXX,00' : brl0(i.arrec)}\nSALDO TOTAL ${fcurta(i.data)}= R$${i.pendente ? 'XX,00' : brl0(i.saldo)}\n\n`;
  });
  t += `Caixa ${fcurta(c.desde)}: ${brl0(c.base)}\n`;
  c.itens.forEach(i => { t += i.tipo === 'jogo' ? (i.pendente ? `(XX,00) --> pendente\n` : `(${i.saldo >= 0 ? '' : '-'}${brl0(Math.abs(i.saldo))}) --> ${brl0(i.acum)}\n`) : `(${i.saldo >= 0 ? '+' : '-'}${brl0(Math.abs(i.saldo))} ${i.c.descricao}) --> ${brl0(i.acum)}\n`; });
  t += `\n*NOVO CAIXA: R$ ${brl0(c.saldo)}*`;
  return t;
}
function gPend() {
  const P = pendencias();
  if (!P.length) return `<div class="card">🎉 Ninguém devendo nada!</div>`;
  const tot = P.reduce((a, p) => a + p.valor, 0);
  let h = `<div class="card hero"><div class="kick">Total pendente</div><div class="big money">${brl(tot)}</div><div class="small muted">${P.length} pendências</div></div>`;
  const grupos = {};
  P.forEach(p => { const k = p.tipo === 'jogo' ? 'Jogo ' + fdata(p.ref.data) : p.tipo === 'evento' ? p.ref.nome : p.ref.categoria; (grupos[k] = grupos[k] || []).push(p); });
  Object.entries(grupos).forEach(([k, ps]) => {
    h += `<div class="sec"><h3>${esc(k)}</h3><span class="tiny money">${brl(ps.reduce((a, p) => a + p.valor, 0))}</span></div><div class="list">
      ${ps.map(p => `<div class="li">${av(p.jogadorId, 'sm', p.nome)}<div class="grow ellip"><b>${esc(p.nome)}</b>${p.tipo === 'cobranca' ? `<div class="tiny">${esc(p.ref.item)}</div>` : ''}</div>
      <b class="money">${brl(p.valor)}</b>${admin() ? `<button class="paybtn" data-act="quitar" data-tipo="${p.tipo}" data-id="${p.i.id}">❌</button>` : ''}</div>`).join('')}</div>`;
  });
  h += `<button class="btn pri full" data-act="textoPend">📲 Texto das pendências</button>`;
  return h;
}
function gUnif() {
  const C = D().Cobrancas || [];
  const tot = C.reduce((a, c) => a + num(c.valor), 0), rec = C.reduce((a, c) => a + Math.min(num(c.pago), num(c.valor)), 0);
  let h = `<div class="card"><div class="row"><div class="grow"><div class="kick">Recebido</div><div class="big money" style="font-size:26px">${brl(rec)}</div></div>
    <div style="text-align:right"><div class="kick" style="color:var(--red)">Falta</div><b class="money">${brl(tot - rec)}</b></div></div>
    <div class="prog" style="margin-top:10px"><i style="width:${tot ? Math.round(rec / tot * 100) : 0}%"></i></div></div>`;
  const cats = [...new Set(C.map(c => c.categoria))];
  cats.forEach(cat => {
    const cs = C.filter(c => c.categoria === cat);
    h += `<div class="sec"><h3>${esc(cat)}</h3></div><div class="list">${cs.map(c => {
      const q = num(c.pago) >= num(c.valor);
      return `<div class="li ${admin() ? 'click' : ''}" ${admin() ? `data-act="editCob" data-id="${c.id}"` : ''}>${av(matchJog(c.pessoa), 'sm', c.pessoa)}
        <div class="grow ellip"><b>${esc(c.pessoa)}</b><div class="tiny">${esc(c.item)}${c.obs ? ' • ' + esc(c.obs) : ''}</div></div>
        <div style="text-align:right"><span class="chip ${q ? 'ok' : num(c.pago) > 0 ? 'or' : 'no'}">${q ? 'pago' : num(c.pago) > 0 ? 'parcial' : 'pendente'}</span><div class="tiny money">${brl(c.pago || 0)} / ${brl(c.valor)}</div></div></div>`;
    }).join('')}</div>`;
  });
  if (admin()) h += `<button class="btn full" data-act="editCob">+ Nova cobrança</button>`;
  return h;
}
function gPatro() {
  const P = D().Patrocinios || [], anos = [...new Set(P.map(p => String(p.ano)))].sort().reverse();
  const lbl = { pago: ['ok', 'pago 💰'], negociacao: ['or', 'em negociação'], interesse: ['blue', 'interesse'] };
  let h = '';
  anos.forEach(a => {
    const ps = P.filter(p => String(p.ano) === a), rec = ps.filter(p => p.status === 'pago').reduce((t, p) => t + num(p.valor), 0);
    h += `<div class="card"><div class="row"><div class="grow"><div class="kick">Patrocínios ${a}</div><div class="big money" style="font-size:26px">${brl(rec)}</div></div>
      <div class="tiny" style="text-align:right">recebido de ${brl(ps.reduce((t, p) => t + num(p.valor), 0))}<br>previstos</div></div></div>
      <div class="list">${ps.map(p => `<div class="li ${admin() ? 'click' : ''}" ${admin() ? `data-act="editPatro" data-id="${p.id}"` : ''}><div class="grow"><b>${esc(p.empresa)}</b></div>
      <span class="chip ${(lbl[p.status] || ['', ''])[0]}">${(lbl[p.status] || ['', p.status])[1]}</span><b class="money" style="min-width:90px;text-align:right">${brl(p.valor)}</b></div>`).join('')}</div>`;
  });
  if (admin()) h += `<button class="btn full" data-act="editPatro">+ Novo patrocinador</button>`;
  return h || '<div class="card muted">Nenhum patrocínio cadastrado.</div>';
}

/* ================= EVENTOS ================= */
function vEventos() {
  const E = [...(D().Eventos || [])].sort((a, b) => a.data < b.data ? 1 : -1);
  if (st.eventoId && E.find(e => e.id === st.eventoId)) return eventoDet(E.find(e => e.id === st.eventoId));
  let h = `<div class="sec" style="margin-top:0"><h2>Eventos</h2>${admin() ? `<button class="btn sm pri" data-act="editEvento">+ Novo evento</button>` : ''}</div>`;
  if (!E.length) return h + `<div class="card muted">Nenhum evento ainda.</div>`;
  E.forEach(e => {
    const ps = (D().EventoParticipantes || []).filter(p => p.eventoId === e.id), pagos = ps.filter(p => yes(p.pago)).length;
    h += `<div class="card click" data-act="abrirEvento" data-id="${e.id}"><div class="row"><div class="grow"><div class="kick">${fdata(e.data)}</div>
      <h3 style="font-size:19px;margin-top:2px">${esc(e.nome)}</h3><div class="small muted">${brl(rateio(e).por)} por pessoa${rateio(e).auto ? ' (gastos divididos)' : ''} • ${ps.length} confirmados • ${pagos} pagos</div></div>
      <span class="chip ${e.status === 'aberto' ? 'or' : ''}">${e.status === 'aberto' ? 'aberto' : 'encerrado'}</span></div></div>`;
  });
  return h;
}
function eventoDet(e) {
  const ps = (D().EventoParticipantes || []).filter(p => p.eventoId === e.id);
  const gs = (D().EventoGastos || []).filter(g => g.eventoId === e.id);
  const r = rateio(e);
  const arrec = ps.reduce((a, p) => a + pagoEvValor(e, p, r), 0), prev = ps.reduce((a, p) => a + devidoEv(e, p, r), 0);
  const gast = r.gastos;
  const eu = ps.find(p => p.jogadorId === st.user.id);
  let h = `<button class="btn sm ghost" data-act="voltarEv" style="margin-bottom:12px">‹ Eventos</button>
    <div class="card hero"><div class="kick">${fdata(e.data)}</div><div class="big">${esc(e.nome)}</div><div class="small" style="margin-top:4px"><b class="money" style="font-size:17px;color:var(--or2)">${brl(r.por)}</b> por pessoa</div>
    <div class="tiny">${r.auto ? `Gastos ${brl(r.gastos)} divididos entre ${r.resto} ${r.resto === 1 ? 'pessoa' : 'pessoas'}${r.resto < r.n ? ` (${r.n - r.resto} com valor próprio)` : ''} • calculado automaticamente` : 'Valor fixo • lance os gastos para o app dividir automaticamente'}${e.obs ? ' • ' + esc(e.obs) : ''}</div>
    <div class="grid2" style="margin-top:14px"><div class="stat"><div class="k">Arrecadado</div><div class="v money" style="font-size:19px">${brl(arrec)}</div><div class="tiny">de ${brl(prev)}</div></div>
    <div class="stat"><div class="k">Saldo</div><div class="v money ${arrec - gast >= 0 ? 'pos' : 'neg'}" style="font-size:19px">${brl(arrec - gast)}</div><div class="tiny">gastos ${brl(gast)}</div></div></div></div>`;
  if (e.status === 'aberto') h += eu ? (yes(eu.pago) ? '' : `<button class="btn danger full" style="margin-bottom:14px" data-act="sairEv" data-id="${eu.id}">Não vou mais</button>`)
    : `<button class="btn pri full" style="margin-bottom:14px" data-act="entrarEv">Eu vou!</button>`;
  h += `<div class="sec"><h3>Participantes (${ps.length})</h3>${admin() ? `<button class="btn sm" data-act="addPart">+ Adicionar</button>` : ''}</div>
    <div class="list">${ps.map((p, k) => `<div class="li"><span class="n">${k + 1}</span>${av(p.jogadorId, 'sm', nomeI(p))}<div class="grow" style="min-width:0"><b>${esc(nomeI(p))}</b><div class="tiny">${brl(devidoEv(e, p, r))}${!blank(p.valor) ? ' (valor próprio)' : ''}${yes(p.pago) && faltaEv(e, p, r) > 0 ? ` • pagou ${brl(pagoEvValor(e, p, r))}, falta ${brl(faltaEv(e, p, r))}` : ''}</div></div>
      ${admin() ? `<button class="paybtn" data-act="pagoEv" data-id="${p.id}" title="pagamento">${!yes(p.pago) ? '❌' : faltaEv(e, p, r) > 0 ? '⚠️' : '✅'}</button><button class="x" style="width:28px;height:28px;font-size:14px" data-act="tirarEv" data-id="${p.id}">×</button>`
      : `<span class="chip ${!yes(p.pago) ? 'no' : faltaEv(e, p, r) > 0 ? 'or' : 'ok'}">${!yes(p.pago) ? 'pendente' : faltaEv(e, p, r) > 0 ? 'falta ' + brl(faltaEv(e, p, r)) : 'pago'}</span>`}</div>`).join('') || '<div class="li empty">Ninguém ainda</div>'}</div>
    <div class="sec"><h3>Gastos <span class="tiny money">${brl(gast)}</span></h3>${admin() ? `<button class="btn sm" data-act="editGasto">+ Gasto</button>` : ''}</div>
    <div class="list">${gs.map(g => `<div class="li ${admin() ? 'click' : ''}" ${admin() ? `data-act="editGasto" data-id="${g.id}"` : ''}><div class="grow">${esc(g.descricao)}</div><b class="money">${brl(g.valor)}</b></div>`).join('') || '<div class="li empty">Nenhum gasto lançado</div>'}</div>
    <div class="btns"><button class="btn pri grow" data-act="textoEv">📲 Texto do evento</button>${admin() ? `<button class="btn ghost" data-act="editEvento" data-id="${e.id}">Editar</button>` : ''}</div>`;
  return h;
}
function textoEvento(e) {
  const ps = (D().EventoParticipantes || []).filter(p => p.eventoId === e.id);
  return preencher('evento', { NOME: e.nome, EMOJI: emojiEv(e), DATA: fdata(e.data), LISTA: ps.map((p, k) => `${k + 1}. ${nomeI(p)}${!blank(p.valor) ? ` (R$${brl0(p.valor)})` : ''} ${!yes(p.pago) ? '❌' : faltaEv(e, p) > 0 ? `⚠️ falta R$${brl0(faltaEv(e, p))}` : '✅'}`).join('\n'), VALOR: brl0(rateio(e).por), PIX: cfg('pix') });
}

/* ================= ELENCO ================= */
function vElenco() {
  const q = norm(st.busca || '');
  const L = (D().Jogadores || []).filter(j => (st.inativos || yes(j.ativo)) && (!q || norm(j.apelido + j.nome).includes(q)))
    .sort((a, b) => a.apelido.localeCompare(b.apelido));
  const S = stats();
  return `<div class="sec" style="margin-top:0"><h2>Elenco</h2>${admin() ? `<button class="btn sm pri" data-act="editJog">+ Jogador</button>` : ''}</div>
    <input class="in" placeholder="Buscar jogador" value="${esc(st.busca || '')}" id="busca" style="margin-bottom:12px">
    <div class="list">${L.map(j => `<div class="li click" data-act="verJog" data-id="${j.id}">${av(j.id)}<div class="grow ellip"><b>${esc(j.apelido)}</b>
      <div class="tiny">${j.posicao === 'goleiro' ? '🥅 Goleiro' : 'Linha'} • ${(S[j.id]?.pontos) || 0} pts • ${(S[j.id]?.gols) || 0} gols${j.papel === 'admin' ? ' • Administrador' : ''}${yes(j.ativo) ? '' : ' • inativo'}</div></div></div>`).join('')}</div>
    ${admin() ? `<label class="row small muted"><input type="checkbox" data-act="inativos" ${st.inativos ? 'checked' : ''}> Mostrar inativos</label>` : ''}`;
}

/* ================= GUIA DA DEMONSTRAÇÃO ================= */
function guiaDemo() {
  const it = (ic, t, d, act) => `<div class="li ${act ? 'click' : ''}" ${act || ''}><span style="font-size:20px;width:26px;text-align:center">${ic}</span><div class="grow"><b>${t}</b><div class="tiny">${d}</div></div>${act ? '<span class="muted">›</span>' : ''}</div>`;
  return `<div class="card hero"><div class="kick">Demonstração • dados fictícios</div><div class="big" style="font-size:24px;margin:4px 0">Bem-vindo, ${esc(st.user.apelido)}!</div>
    <div class="small muted">Você entrou como <b>${admin() ? 'Administrador' : 'Jogador'}</b>. Toque nos itens para conhecer:</div></div>
    <div class="list">
      ${it('📋', 'Lista da quinta', 'Entre ou saia da lista com um toque. O texto do WhatsApp sai pronto.', 'data-act="verJogo" data-id="g_0511" data-sub="lista"')}
      ${it('⚔️', 'Times e resultado', 'Veja a última rodada: times, placar e quem fez gol.', 'data-act="verJogo" data-id="g_2910" data-sub="resultado"')}
      ${it('🗳️', 'Bola cheia e bola murcha', 'Votação aberta para quem jogou, com voto público.', 'data-act="verJogo" data-id="g_2910" data-sub="votacao"')}
      ${it('🏆', 'Tabelas', 'Pontuação, artilharia, bola cheia, bola murcha e goleiros.', 'data-act="tab" data-t="tabela"')}
      ${it('📈', 'Números e PDF', 'Últimas rodadas, aproveitamento e relatório da rodada.', 'data-act="tab" data-t="indic"')}
      ${!admin() ? '' : it('💰', 'Caixa e pendências', 'Saldo do time, quem falta pagar, uniformes e patrocínios.', 'data-act="tab" data-t="grana"')}
      ${it('🎉', 'Eventos', 'Churrascos e festas com lista de quem vai e quem pagou.', 'data-act="tab" data-t="eventos"')}
      ${it('📸', 'Perfil e mídias', 'Cada um tem sua página com números, fotos e vídeos.', 'data-act="perfil"')}
      ${admin() ? it('🛠️', 'Só para administradores', 'Montar times equilibrados, lançar placar, marcar pagamentos e editar os textos.', 'data-act="tab" data-t="config"') : ''}
      ${it('🔔', 'Notificações', 'No app de verdade, avisa no celular quando alguém vota, lança gol ou abre a lista.', '')}
    </div>
    <div class="btns" style="margin-bottom:18px">${window.EFC_DEMO_SO_JOGADOR ? '' : `<button class="btn ghost grow" data-act="demoTrocar">${admin() ? '⚽ Ver como Jogador' : '🛠️ Ver como Administrador'}</button>`}<button class="btn ghost ${window.EFC_DEMO_SO_JOGADOR ? 'grow' : ''}" data-act="demoGuiaOk">Esconder guia</button></div>`;
}

/* ================= NOTIFICAÇÕES ================= */
const TIPOS_NOTIF = [['voto', 'Votos na bola cheia e bola murcha'], ['gol', 'Gols lançados pelos jogadores'], ['lista', 'Lista aberta'],
  ['times', 'Times definidos'], ['resultado', 'Resultado do jogo'], ['votacao', 'Votação encerrada'], ['evento', 'Novo evento']];
const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const pushSuportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function b64u8(t) { const p = '='.repeat((4 - t.length % 4) % 4), b = atob((t + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function metaSW() {
  if (DEMO || !('caches' in window)) return;
  try { const c = await caches.open('efc-meta'); if (st.token) await c.put('/__efc/token', new Response(st.token)); else await c.delete('/__efc/token'); } catch (e) { }
}
async function minhaAssinatura() {
  if (!pushSuportado()) return null;
  try { const reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; }
}
async function estadoNotif() {
  if (DEMO) return 'demo';
  if (IOS && !instalado()) return 'ios-instalar';
  if (!pushSuportado()) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  return (await minhaAssinatura()) ? 'ligado' : 'desligado';
}
const aparelho = () => IOS ? 'iPhone' : /android/i.test(navigator.userAgent) ? 'Android' : 'Computador';
async function sincronizarNotif() {
  st.notif = await estadoNotif();
  if (st.notif === 'ligado') { const sub = await minhaAssinatura(); if (sub) api('assinar', { sub: sub.toJSON(), aparelho: aparelho() }).catch(() => { }); }
  metaSW();
}
async function ligarNotif() {
  const perm = await Notification.requestPermission(); // precisa ser a 1ª coisa depois do toque
  if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações do app nas configurações do celular.');
  const reg = await navigator.serviceWorker.ready;
  const { chave } = await api('vapid');
  if (!chave) throw new Error('O servidor ainda não tem a chave das notificações. Rode "configurar" no Apps Script.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u8(chave) });
  await api('assinar', { sub: sub.toJSON(), aparelho: aparelho() });
  await metaSW(); st.notif = 'ligado';
}
async function desligarNotif() {
  const sub = await minhaAssinatura();
  if (sub) { await api('desassinar', { endpoint: sub.endpoint }).catch(() => { }); await sub.unsubscribe().catch(() => { }); }
  st.notif = await estadoNotif();
}
function telaNotif() {
  const e = st.notif;
  const corpo = {
    demo: `<p class="muted">As notificações funcionam no app instalado pelo link do time (não nesta demonstração).</p>`,
    'ios-instalar': `<p>No iPhone as notificações só funcionam com o app instalado:</p><ol class="small" style="padding-left:18px;line-height:1.7">
      <li>Abra o link do app no <b>Safari</b></li><li>Toque em <b>Compartilhar</b> (quadrado com seta)</li><li><b>Adicionar à Tela de Início</b></li>
      <li>Abra pelo ícone do escudo e volte aqui</li></ol><p class="tiny">Precisa do iOS 16.4 ou mais novo.</p>`,
    'sem-suporte': `<p class="muted">Este navegador não recebe notificações. No Android use o <b>Chrome</b>; no iPhone, o app instalado na Tela de Início (iOS 16.4+).</p>`,
    bloqueado: `<p>As notificações estão <b>bloqueadas</b> para o app neste aparelho.</p><p class="small muted">${IOS ? 'Ajustes do iPhone → Notificações → Entrevero → Permitir.' : 'No Chrome: toque no cadeado/ícone ao lado do endereço (ou Configurações do site) → Notificações → Permitir.'} Depois volte aqui.</p>`,
    desligado: `<p>Receba aviso na hora quando alguém votar, lançar gols, abrir a lista, sair o resultado e mais.</p><button class="btn pri full" data-act="notifLigar">🔔 Ativar notificações</button>`,
    ligado: `<div class="card" style="margin-bottom:12px"><span class="chip ok">✓ Ativadas neste aparelho</span></div>
      <div class="btns" style="flex-direction:column"><button class="btn full" data-act="notifTeste">📨 Enviar notificação de teste</button>
      <button class="btn danger full" data-act="notifDesligar">Desativar neste aparelho</button></div>`
  }[e] || '';
  modal('🔔 Notificações', corpo + (admin() && e !== 'demo' ? `<div class="tiny" style="margin-top:14px">Quais avisos o time recebe: ⚙️ Configurações e textos → Notificações.</div>` : ''));
}
function quando(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'agora'; if (m < 60) return `há ${m} min`; if (m < 24 * 60) return `há ${Math.round(m / 60)} h`;
  if (m < 48 * 60) return 'ontem'; return fcurta(iso.slice(0, 10));
}
const listaAvisos = n => `<div class="list">${(D().Avisos || []).slice(0, n).map(a => `<div class="li" style="align-items:flex-start"><div class="grow"><b>${esc(a.titulo)}</b>
  <div class="small muted">${esc(a.texto)}</div></div><span class="tiny" style="white-space:nowrap">${quando(a.data)}</span></div>`).join('') || '<div class="li empty">Nenhum aviso ainda</div>'}</div>`;

/* ================= INDICADORES ================= */
function rodadasApp() {
  const base = num(cfg('rodadaBase', 34));
  return jogosOrd().filter(temResultado).map((j, k) => Object.assign({ n: base + k + 1 }, { j }));
}
function vIndic() {
  const R = rodadasApp(), S = stats();
  const gols = R.reduce((t, r) => t + num(r.j.golsVermelho) + num(r.j.golsAzul), 0);
  const vv = R.filter(r => num(r.j.golsVermelho) > num(r.j.golsAzul)).length, va = R.filter(r => num(r.j.golsAzul) > num(r.j.golsVermelho)).length;
  const maior = [...R].sort((a, b) => Math.abs(b.j.golsVermelho - b.j.golsAzul) - Math.abs(a.j.golsVermelho - a.j.golsAzul))[0];
  const pres = Object.values(S).filter(s => s.jogos > 0 && J(s.id)).sort((a, b) => b.jogos - a.jogos || b.pontos - a.pontos);
  let h = `<div class="row" style="justify-content:space-between;margin-bottom:12px"><h2>📈 Números do time</h2><button class="btn sm pri" data-act="pdf">📄 Exportar PDF</button></div>
    <div class="grid2" style="margin-bottom:14px">
      <div class="stat"><div class="k">Rodada atual</div><div class="v">${rodadaAtual()}</div><div class="tiny">${R.length} lançadas no app</div></div>
      <div class="stat"><div class="k">Gols por jogo</div><div class="v">${R.length ? (gols / R.length).toFixed(1).replace('.', ',') : '—'}</div><div class="tiny">${gols} gols no app</div></div>
      <div class="stat"><div class="k">🔴 x 🔵</div><div class="v" style="font-size:20px">${vv} x ${va}</div><div class="tiny">${R.length - vv - va} empates</div></div>
      <div class="stat"><div class="k">Maior placar</div><div class="v" style="font-size:20px">${maior ? `${maior.j.golsVermelho} x ${maior.j.golsAzul}` : '—'}</div><div class="tiny">${maior ? fdata(maior.j.data) : ''}</div></div></div>`;
  h += `<div class="sec"><h2>Últimas rodadas</h2></div>`;
  if (!R.length) h += `<div class="card muted small">Assim que os resultados forem lançados no app, cada rodada aparece aqui com os times, gols, bola cheia e bola murcha.</div>`;
  [...R].reverse().slice(0, 10).forEach(r => {
    const ins = inscritos(r.j.id).filter(i => i.time);
    const time = t => ins.filter(i => i.time === t).sort((a, b) => yes(b.goleiro) - yes(a.goleiro)).map(i => `${yes(i.goleiro) ? '🥅 ' : ''}${esc(nomeI(i))}${num(i.gols) ? ` <b style="color:var(--or2)">${'⚽'.repeat(Math.min(num(i.gols), 5))}${num(i.gols) > 5 ? num(i.gols) : ''}</b>` : ''}`).join(', ');
    h += `<div class="card click" data-act="verJogo" data-id="${r.j.id}" data-sub="resultado"><div class="row"><div class="grow"><div class="kick">Rodada ${r.n} • ${fdata(r.j.data)}</div></div>
      <div class="disp" style="font-size:22px"><span style="color:var(--red)">${r.j.golsVermelho}</span> x <span style="color:#6aa8ff">${r.j.golsAzul}</span></div></div>
      <div class="small" style="margin-top:8px">🔴 ${time('V')}</div><div class="small" style="margin-top:4px">🔵 ${time('A')}</div>
      ${(csv(r.j.craqueIds).length || csv(r.j.murchaIds).length) ? `<div class="small muted" style="margin-top:8px">⭐ ${csv(r.j.craqueIds).map(id => esc(J(id)?.apelido)).join(', ') || '—'} &nbsp; 🎈 ${csv(r.j.murchaIds).map(id => esc(J(id)?.apelido)).join(', ') || '—'}</div>` : ''}</div>`;
  });
  if (pres.length) {
    h += `<div class="sec"><h2>Presença e aproveitamento</h2><span class="tiny">só jogos do app</span></div><div class="list">${pres.map(s => {
      const ap = Math.round((s.v * 3 + s.e) / (s.jogos * 3) * 100);
      return `<div class="rk" data-act="verJog" data-id="${s.id}" style="cursor:pointer">${av(s.id, 'sm')}<div class="grow"><b>${esc(J(s.id).apelido)}</b><div class="sub">${s.jogos} jogos • ${s.v}V ${s.e}E ${s.d}D</div></div><div class="v">${ap}%</div></div>`;
    }).join('')}</div>`;
  }
  return h;
}
function relatorioHTML() {
  const ult = jogosOrd().filter(temResultado).pop();
  const tab = (titulo, linhas, cols) => `<div class="pcol"><h3>${titulo}</h3><table><thead><tr><th></th><th>Jogador</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
    ${linhas.map(l => `<tr class="${l.pos === 1 ? 'p1' : ''}"><td>${l.pos}º</td><td>${esc(J(l.id).apelido)}</td>${l.vals.map(v => `<td>${v}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9">—</td></tr>'}</tbody></table></div>`;
  const R = rodadasApp().reverse().slice(0, 5);
  return `<div class="phead"><img src="icons/escudo.png" alt=""><div><h1>Entrevero Futsal Clube</h1><div class="psub">RODADA-${rodadaAtual()} • ${fdata(ult ? ult.data : hoje())}</div></div></div>
    <div class="pgrid">
    ${tab('⚽ Artilharia', ranking('gols').map(s => ({ pos: s.pos, id: s.id, vals: [s.gols] })), ['Gols'])}
    ${tab('⭐ Bola cheia', ranking('craques').map(s => ({ pos: s.pos, id: s.id, vals: [s.craques] })), ['Vezes'])}
    ${tab('🥅 Goleiro menos vazado', ranking('media').map(s => ({ pos: s.pos, id: s.id, vals: [s.gs, s.jg, s.media.toFixed(1).replace('.', ',')] })), ['Gols', 'Jogos', 'Média'])}
    ${tab('🏆 Pontuação geral', ranking('pontos').map(s => ({ pos: s.pos, id: s.id, vals: [s.pontos] })), ['Pts'])}
    </div>
    ${ranking('murchas').length ? `<div class="pgrid" style="grid-template-columns:1fr 3fr;margin-top:10px">${tab('🎈 Bola murcha', ranking('murchas').map(s => ({ pos: s.pos, id: s.id, vals: [s.murchas] })), ['Vezes'])}<div></div></div>` : ''}
    ${R.length ? `<h3 style="margin-top:14px">Últimas rodadas</h3><table class="prod"><thead><tr><th>Rodada</th><th>Data</th><th>Placar</th><th>🔴 Vermelho</th><th>🔵 Azul</th><th>⭐ / 🎈</th></tr></thead><tbody>
      ${R.map(r => { const ins = inscritos(r.j.id).filter(i => i.time); const t = x => ins.filter(i => i.time === x).map(i => esc(nomeI(i)) + (num(i.gols) ? ` (${i.gols})` : '')).join(', ');
        return `<tr><td>${r.n}</td><td>${fcurta(r.j.data)}</td><td><b>${r.j.golsVermelho} x ${r.j.golsAzul}</b></td><td>${t('V')}</td><td>${t('A')}</td><td>${csv(r.j.craqueIds).map(id => esc(J(id)?.apelido)).join(', ') || '—'} / ${csv(r.j.murchaIds).map(id => esc(J(id)?.apelido)).join(', ') || '—'}</td></tr>`; }).join('')}</tbody></table>` : ''}
    <div class="pfoot">VITÓRIA = 3 • EMPATE = 1 • DERROTA = 0 — gerado pelo app em ${fdata(hoje())}</div>`;
}

/* ================= CONFIGURAÇÕES ================= */
const CAMPOS = [['pix', 'Chave Pix'], ['valorJogador', 'Valor jogador (R$)'], ['valorGoleiro', 'Valor goleiro (R$)'], ['quadra', 'Quadra (R$)'],
  ['hora', 'Horário padrão'], ['vagasLinha', 'Vagas de linha'], ['vagasGoleiro', 'Vagas de goleiro'], ['rodadaBase', 'Última rodada antes do app']];
function vConfig() {
  if (!admin()) { st.tab = 'inicio'; return vInicio(); }
  return `<div class="sec" style="margin-top:0"><h2>⚙️ Configurações</h2></div>
    <form class="card" id="cfgForm"><div class="grid2">${CAMPOS.map(([k, l]) => `<label class="f" ${k === 'pix' ? 'style="grid-column:1/-1"' : ''}><span>${l}</span>${['valorJogador', 'valorGoleiro', 'quadra'].includes(k) ? campoMoeda(k, cfg(k)) : `<input class="in" name="${k}" value="${esc(cfg(k))}">`}</label>`).join('')}</div>
    <button type="button" class="btn pri full" data-act="salvarCfg">Salvar configurações</button></form>
    <div class="sec"><h2>🔔 Notificações</h2></div>
    <form class="card" id="notifForm"><div class="small muted" style="margin-bottom:6px">Quais avisos o time recebe no celular:</div>
      ${TIPOS_NOTIF.map(([k, l]) => `<label class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer"><span>${l}</span>
        <input type="checkbox" name="notif_${k}" style="width:22px;height:22px;accent-color:var(--or)" ${cfg('notif_' + k) !== 'N' ? 'checked' : ''}></label>`).join('')}
      <button type="button" class="btn pri full" style="margin-top:12px" data-act="salvarNotifCfg">Salvar</button></form>
    <div class="sec"><h2>✍️ Modelos de texto</h2></div>
    <div class="small muted" style="margin-bottom:10px">São os textos que o app monta para o WhatsApp. Edite como quiser; o que está entre chaves, como {DATA}, é preenchido sozinho.</div>
    <div class="list">${Object.entries(MODELOS).map(([k, m]) => `<div class="li click" data-act="editModelo" data-id="${k}"><div class="grow"><b>${m.nome}</b>
      <div class="tiny">${blank(cfg('tpl_' + k, '')) ? 'padrão' : 'personalizado'}</div></div><span class="muted">›</span></div>`).join('')}</div>`;
}

/* ================= JOGADOR E GALERIA ================= */
const midias = () => [...(D().Midias || [])].sort((a, b) => a.data < b.data ? 1 : a.data > b.data ? -1 : (a.id < b.id ? 1 : -1));
function urlMidia(m, w = 600) {
  if (String(m.arquivoId).startsWith('demo:')) return st.midiaLocal[m.arquivoId] || '';
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m.arquivoId)}&sz=w${w}`;
}
function gradeMidias(lista, comNome) {
  if (!lista.length) return `<div class="card muted small">Nenhuma foto ou vídeo ainda.</div>`;
  return `<div class="gal">${lista.map(m => `<button class="gi" data-act="verMidia" data-id="${m.id}">
    ${m.tipo === 'video' && String(m.arquivoId).startsWith('demo:') ? `<video src="${urlMidia(m)}" muted playsinline></video>` : `<img loading="lazy" src="${urlMidia(m)}" alt="" onerror="this.style.opacity=0">`}
    ${m.tipo === 'video' ? '<span class="play">▶</span>' : ''}${comNome ? `<span class="who">${esc(J(m.jogadorId)?.apelido || '')}</span>` : ''}</button>`).join('')}</div>`;
}
function vJogador() {
  const j = J(st.jogadorId); if (!j) { st.tab = 'elenco'; return vElenco(); }
  const s = stats()[j.id] || {}, eu = j.id === st.user.id;
  const pos = ranking('pontos').find(r => r.id === j.id);
  const ms = midias().filter(m => m.jogadorId === j.id);
  return `<button class="btn sm ghost" data-act="voltarJog" style="margin-bottom:12px">‹ Voltar</button>
    <div class="card hero"><div class="row">${av(j.id, 'lg')}<div class="grow"><div class="kick">${j.posicao === 'goleiro' ? '🥅 Goleiro' : 'Linha'}${pos ? ` • ${pos.pos}º na pontuação` : ''}</div><span class="chip ${j.papel === 'admin' ? 'or' : ''}" style="margin:2px 0 4px">${j.papel === 'admin' ? 'Administrador' : 'Jogador'}</span>
      <div class="big" style="font-size:30px">${esc(j.apelido)}</div><div class="small muted">${esc(j.nome)}</div></div></div></div>
    <div class="grid2" style="margin-bottom:14px"><div class="stat"><div class="k">Pontos</div><div class="v">${s.pontos || 0}</div></div><div class="stat"><div class="k">Gols</div><div class="v">${s.gols || 0}</div></div>
      <div class="stat"><div class="k">⭐ Bola cheia</div><div class="v">${s.craques || 0}</div></div><div class="stat"><div class="k">🎈 Bola murcha</div><div class="v">${s.murchas || 0}</div></div>
      ${s.jg ? `<div class="stat"><div class="k">Gols sofridos</div><div class="v">${s.gs}<span class="tiny"> em ${s.jg}</span></div></div>` : ''}${s.jogos ? `<div class="stat"><div class="k">No app</div><div class="v" style="font-size:18px">${s.v}V ${s.e}E ${s.d}D</div></div>` : ''}</div>
    <div class="sec"><h2>📸 Mídias</h2><label class="btn sm pri">+ Foto / vídeo<input type="file" accept="image/*,video/*" hidden data-midia="${j.id}"></label></div>
    ${gradeMidias(ms)}
    ${(eu || admin()) ? `<div class="btns" style="margin-top:16px"><label class="btn ghost grow">📷 Trocar foto do perfil<input type="file" accept="image/*" hidden data-foto="${j.id}"></label></div>` : ''}
    ${admin() ? `<div class="btns" style="margin-top:8px"><button class="btn ghost grow" data-act="editJog" data-id="${j.id}">✎ Editar dados</button><button class="btn ghost grow" data-act="resetSenha" data-id="${j.id}">🔑 Senha temporária</button></div>` : ''}`;
}
function vGaleria() {
  const f = st.galFiltro || '';
  const L = midias().filter(m => !f || m.jogadorId === f);
  const comMidia = [...new Set(midias().map(m => m.jogadorId))].map(J).filter(Boolean).sort((a, b) => a.apelido.localeCompare(b.apelido));
  return `<div class="sec" style="margin-top:0"><h2>📸 Galeria</h2><label class="btn sm pri">+ Minha mídia<input type="file" accept="image/*,video/*" hidden data-midia="${st.user.id}"></label></div>
    <div class="row" style="overflow-x:auto;gap:8px;margin-bottom:12px;padding-bottom:2px"><button class="chip ${!f ? 'or' : ''}" style="border:0;padding:8px 12px" data-act="galF" data-id="">Todos</button>
    ${comMidia.map(j => `<button class="chip ${f === j.id ? 'or' : ''}" style="border:0;padding:8px 12px;white-space:nowrap" data-act="galF" data-id="${j.id}">${esc(j.apelido)}</button>`).join('')}</div>
    ${gradeMidias(L, true)}<div class="tiny" style="margin-top:10px">Para postar no perfil de outro jogador, abra o perfil dele no Elenco.</div>`;
}
function verMidia(id) {
  const m = (D().Midias || []).find(x => x.id === id); if (!m) return;
  const demo = String(m.arquivoId).startsWith('demo:');
  const corpo = m.tipo === 'video'
    ? (demo ? `<video src="${urlMidia(m)}" controls autoplay playsinline style="width:100%;max-height:65vh;border-radius:12px;background:#000"></video>`
      : `<iframe src="https://drive.google.com/file/d/${encodeURIComponent(m.arquivoId)}/preview" allow="autoplay" allowfullscreen style="width:100%;aspect-ratio:9/12;max-height:65vh;border:0;border-radius:12px;background:#000"></iframe>`)
    : `<img src="${urlMidia(m, 1600)}" style="width:100%;max-height:65vh;object-fit:contain;border-radius:12px;background:#000">`;
  const pode = admin() || m.autorId === st.user.id || m.jogadorId === st.user.id;
  modal(esc(J(m.jogadorId)?.apelido || ''), `${corpo}${m.legenda ? `<p style="margin:12px 0 4px"><b>${esc(m.legenda)}</b></p>` : ''}
    <div class="tiny" style="margin:6px 0 14px">${fdata(m.data)} • postado por ${esc(J(m.autorId)?.apelido || '?')}</div>
    <div class="btns">${!demo ? `<a class="btn grow" style="text-decoration:none" target="_blank" href="https://drive.google.com/file/d/${encodeURIComponent(m.arquivoId)}/view">Abrir / baixar</a>` : ''}
    ${pode ? `<button class="btn danger" data-act="excluirMidia" data-id="${m.id}">Excluir</button>` : ''}</div>`);
}
function prepararMidia(file) {
  return new Promise((ok, no) => {
    if (file.type.startsWith('video/')) {
      if (file.size > 20 * 1024 * 1024) return no(new Error('Vídeo muito grande (máximo 20 MB). Corte ou envie em qualidade menor.'));
      const fr = new FileReader();
      fr.onload = () => ok({ mime: file.type || 'video/mp4', b64: fr.result.split(',')[1], url: fr.result });
      fr.onerror = () => no(new Error('Não consegui ler o vídeo.')); fr.readAsDataURL(file); return;
    }
    if (!file.type.startsWith('image/')) return no(new Error('Envie uma foto ou um vídeo.'));
    const img = new Image(), fr = new FileReader();
    fr.onload = () => { img.src = fr.result; };
    img.onload = () => {
      const M = 1600, k = Math.min(1, M / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.85); ok({ mime: 'image/jpeg', b64: url.split(',')[1], url });
    };
    img.onerror = () => no(new Error('Não consegui ler a imagem.'));
    fr.readAsDataURL(file);
  });
}

/* ================= AÇÕES ================= */
const ACT = {
  fechar: fechar,
  tab: d => { fechar(); st.tab = d.t; st.eventoId = null; if (d.sub) st.tabTab = d.sub; render(); scrollTo(0, 0); },
  jogoTab: d => { st.jogoTab = d.t; render(); },
  tabTab: d => { st.tabTab = d.t; render(); },
  granaTab: d => { st.granaTab = d.t; render(); },
  selJogo: d => { st.jogoId = d.id; st.rascunho = null; st.res = null; render(); },
  verJogo: d => { st.tab = 'jogo'; st.jogoId = d.id; st.jogoTab = d.sub || (inscritos(d.id).some(i => i.time) && jogo(d.id).status !== 'aberta' ? 'times' : 'lista'); render(); scrollTo(0, 0); },
  copiarTxt: (d, el) => copiar(el.closest('.modal')._txt),
  copiarPix: () => copiar(cfg('pix')),
  menu: () => modal(esc(st.user.apelido), `<div class="row" style="margin-bottom:16px">${av(st.user.id, 'lg')}<div><div class="small muted">usuário</div><b>${esc(st.user.login)}</b>
      <div><span class="chip ${admin() ? 'or' : ''}">${admin() ? 'Administrador' : 'Jogador'}</span></div></div></div>
    <label class="btn full" style="margin-bottom:8px">📷 Trocar minha foto<input type="file" accept="image/*" hidden data-foto="${st.user.id}"></label>
    <button class="btn full" style="margin-bottom:8px" data-act="trocarSenha">🔑 Trocar senha</button>
    <button class="btn full" style="margin-bottom:8px" data-act="perfil">⚽ Meu perfil e mídias</button>
    <button class="btn full" style="margin-bottom:8px" data-act="tab" data-t="elenco">👥 Elenco</button>
    <button class="btn full" style="margin-bottom:8px" data-act="tab" data-t="galeria">📸 Galeria do time</button>
    ${admin() ? `<button class="btn full" style="margin-bottom:8px" data-act="verArquivados">🗄️ Jogos arquivados${(D().Jogos || []).some(j => yes(j.arquivado)) ? ` <span class="chip">${D().Jogos.filter(j => yes(j.arquivado)).length}</span>` : ''}</button>` : ''}
    ${admin() ? '<button class="btn full" style="margin-bottom:8px" data-act="tab" data-t="config">⚙️ Configurações e textos</button>' : ''}
    ${window.EFC_DEMO_GUIA ? `<button class="btn full" style="margin-bottom:8px" data-act="demoGuia">🧭 Guia da demonstração</button>
      ${window.EFC_DEMO_SO_JOGADOR ? '' : `<button class="btn full" style="margin-bottom:8px" data-act="demoTrocar">${admin() ? '⚽ Ver como Jogador' : '🛠️ Ver como Administrador'}</button>`}
      <button class="btn full" style="margin-bottom:8px" data-act="demoReset">↺ Recomeçar demonstração</button>` : ''}
    <button class="btn full" style="margin-bottom:8px" data-act="notifAbrir">🔔 Notificações${st.notif === 'ligado' ? ' <span class="chip ok">ativas</span>' : ''}</button>
    <button class="btn full" style="margin-bottom:8px" data-act="atualizar">🔄 Atualizar dados</button>
    <button class="btn danger full" data-act="sair">Sair</button>`),
  atualizar: () => { fechar(); fazer(async () => { await carregar(); toast('Atualizado'); }); },
  sair: () => sair(),
  trocarSenha: () => telaSenha(false),

  entrar: d => fazer(async () => {
    const j = jogo(d.id), ord = Math.max(0, ...inscritos(d.id).map(i => num(i.ordem))) + 1;
    await salvar('Inscricoes', { jogoId: j.id, jogadorId: st.user.id, nomeAvulso: '', goleiro: d.gk, ordem: ord, time: '', gols: '', pago: 'N', valor: '' }, 'Você entrou na lista! ⚽');
  }),
  tirar: d => {
    const i = D().Inscricoes.find(x => x.id === d.id); if (!i) return;
    if (!confirmar(i.jogadorId === st.user.id ? 'Sair da lista?' : `Tirar ${nomeI(i)} da lista?`)) return;
    fazer(() => excluir('Inscricoes', i.id, 'Removido da lista'));
  },
  pago: d => fazer(() => { const i = D().Inscricoes.find(x => x.id === d.id); return salvar('Inscricoes', Object.assign({}, i, { pago: yes(i.pago) ? 'N' : 'S' })); }),
  addInsc: () => {
    const j = jogo(st.jogoId), ja = inscritos(j.id).map(i => i.jogadorId);
    const ops = (D().Jogadores || []).filter(x => yes(x.ativo) && !ja.includes(x.id)).sort((a, b) => a.apelido.localeCompare(b.apelido));
    modal('Adicionar na lista', `<label class="f"><span>Jogador</span><select class="in" id="aj"><option value="">— convidado (digite abaixo) —</option>
      ${ops.map(o => `<option value="${o.id}" data-gk="${o.posicao === 'goleiro' ? 'S' : 'N'}">${esc(o.apelido)}</option>`).join('')}</select></label>
      <label class="f"><span>Nome do convidado</span><input class="in" id="an" placeholder="Só se não estiver no elenco"></label>
      <label class="row" style="margin-bottom:16px"><input type="checkbox" id="ag"> Vai jogar no gol</label>
      <button class="btn pri full" data-act="addInscOk">Adicionar</button>`, m => {
      $('#aj', m).onchange = e => { $('#ag', m).checked = e.target.selectedOptions[0].dataset.gk === 'S'; };
    });
  },
  textoLista: () => {
    const j = jogo(st.jogoId);
    modal('Texto da lista', `<label class="row" style="margin-bottom:10px"><input type="checkbox" id="cp" checked> Incluir pendências em cima</label><pre class="wa" id="prev"></pre>
      <div class="btns" style="margin-top:12px"><button class="btn pri grow" data-act="copiarTxt">Copiar</button><a class="btn" id="wal" style="text-decoration:none" target="_blank">Abrir WhatsApp</a></div>`, m => {
      const up = () => { m._txt = textoLista(j, $('#cp', m).checked); $('#prev', m).textContent = m._txt; $('#wal', m).href = 'https://wa.me/?text=' + encodeURIComponent(m._txt); };
      $('#cp', m).onchange = up; up();
    });
  },
  textoVot: () => {
    const j = jogo(st.jogoId), vs = (D().Votos || []).filter(v => v.jogoId === j.id);
    const cont = f => { const c = {}; vs.forEach(v => { if (v[f]) c[v[f]] = (c[v[f]] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${J(id)?.apelido} – ${n}`).join('\n') || '—'; };
    mostrarTexto('Votação', preencher('votacao', { DATA: fdata(j.data), BOLA_CHEIA: cont('craqueId'), BOLA_MURCHA: cont('murchaId'),
      VOTOS: vs.map(v => `${J(v.eleitorId)?.apelido}: ⭐ ${J(v.craqueId)?.apelido || '—'} | 🎈 ${J(v.murchaId)?.apelido || '—'}`).join('\n') || '—' }));
  },
  textoTimes: () => mostrarTexto('Escalação', textoTimes(jogo(st.jogoId))),
  textoPend: () => mostrarTexto('Pendências', textoPendencias()),
  textoTabela: () => mostrarTexto('Tabelas', textoTabela()),
  textoBalanco: () => mostrarTexto('Balanço', textoBalanco()),
  textoEv: () => mostrarTexto('Evento', textoEvento(D().Eventos.find(e => e.id === st.eventoId))),

  novoJogo: () => {
    const usados = (D().Jogos || []).map(j => j.data);
    const d = new Date(); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
    while (usados.includes(iso(d))) d.setDate(d.getDate() + 7);
    formJogo({ data: iso(d), hora: cfg('hora', '18h00'), valorJogador: cfg('valorJogador', 15), valorGoleiro: cfg('valorGoleiro', 13), quadra: cfg('quadra', 130), status: 'aberta' });
  },
  editJogo: () => formJogo(jogo(st.jogoId)),
  salvarJogo: (d, el) => {
    const f = formDados(el.closest('form'));
    const base = f.id ? jogo(f.id) : { golsVermelho: '', golsAzul: '', votacao: '', craqueIds: '', murchaIds: '', arrecadadoManual: '', legado: '', obs: '' };
    fechar();
    fazer(async () => { const r = await salvar('Jogos', Object.assign({}, base, f), 'Jogo salvo'); st.jogoId = r.linhas[0].id; st.jogoTab = 'lista'; render(); });
  },
  excluirJogo: (d) => {
    const j = jogo(d.id), t = travaJogo(j);
    if (t) return toast(`Não dá para excluir: o jogo já tem ${t}. Use Arquivar.`, true);
    if (!confirmar('Excluir esta lista? Use só para lista criada por engano ou jogo cancelado.')) return;
    fechar();
    fazer(async () => { await api('excluir', { tabela: 'Jogos', ids: [d.id] }); st.d.Inscricoes = st.d.Inscricoes.filter(i => i.jogoId !== d.id);
      st.d.Votos = (st.d.Votos || []).filter(v => v.jogoId !== d.id); st.d.Jogos = st.d.Jogos.filter(x => x.id !== d.id); st.jogoId = null; render(); toast('Lista excluída'); });
  },
  arquivarJogo: d => {
    const j = jogo(d.id); fechar();
    fazer(async () => { await salvar('Jogos', Object.assign({}, j, { arquivado: 'S' }), `Jogo de ${fcurta(j.data)} arquivado 🗄️`); st.jogoId = null; render(); });
  },
  desarquivarJogo: d => {
    const j = jogo(d.id); fechar();
    fazer(async () => { await salvar('Jogos', Object.assign({}, j, { arquivado: '' }), `Jogo de ${fcurta(j.data)} voltou para a lista`); st.tab = 'jogo'; st.jogoId = j.id; render(); });
  },
  verArquivados: () => {
    fechar();
    const L = jogosOrd().filter(j => yes(j.arquivado)).reverse();
    modal('🗄️ Jogos arquivados', L.length ? `<div class="small muted" style="margin-bottom:10px">Continuam contando nas tabelas, no caixa e nas pendências. Só saíram da tela do Jogo.</div>
      <div class="list">${L.map(j => { const ins = inscritos(j.id), pend = ins.filter(i => !yes(i.pago)).length;
        return `<div class="li"><div class="grow"><b>${DIAS[dt(j.data).getDay()].split('-')[0]} ${fdata(j.data)}</b>
          <div class="tiny">${temResultado(j) ? `Vermelho ${j.golsVermelho} x ${j.golsAzul} Azul • ` : ''}${ins.length} na lista${pend ? ` • ${pend} sem pagar` : ''}</div></div>
          <button class="btn sm ghost" data-act="abrirArquivado" data-id="${j.id}">Abrir</button><button class="btn sm" data-act="desarquivarJogo" data-id="${j.id}">Desarquivar</button></div>`; }).join('')}</div>`
      : `<div class="card muted">Nenhum jogo arquivado. Para arquivar, abra o jogo, toque em <b>Editar</b> e depois em <b>Arquivar</b>.</div>`);
  },
  abrirArquivado: d => { fechar(); st.tab = 'jogo'; st.jogoId = d.id; st.jogoTab = inscritos(d.id).some(i => i.time) ? 'resultado' : 'lista'; render(); scrollTo(0, 0); },
  statusJogo: d => fazer(() => salvar('Jogos', Object.assign({}, jogo(st.jogoId), { status: d.s }), d.s === 'fechada' ? 'Lista fechada' : 'Lista reaberta')),

  sortear: () => { const j = jogo(st.jogoId); const s = sugestoes(j); if (!s.length) return toast('Lista vazia', true);
    st.sugs = s; st.sugI = 0; st.rascunho = { jogoId: j.id, V: s[0].V, A: s[0].A }; st.jogoTab = 'times'; render(); },
  outraSug: () => { if (!st.sugs) return; st.sugI = (st.sugI + 1) % st.sugs.length; const s = st.sugs[st.sugI]; st.rascunho.V = s.V; st.rascunho.A = s.A; render(); },
  editarTimes: () => { const ins = inscritos(st.jogoId); st.rascunho = { jogoId: st.jogoId, V: ins.filter(i => i.time === 'V').map(i => i.id), A: ins.filter(i => i.time === 'A').map(i => i.id) }; render(); },
  cancelarTimes: () => { st.rascunho = null; render(); },
  mover: d => { const r = st.rascunho; if (r.V.includes(d.id)) { r.V = r.V.filter(x => x !== d.id); r.A.push(d.id); } else { r.A = r.A.filter(x => x !== d.id); r.V.push(d.id); } render(); },
  salvarTimes: () => {
    const r = st.rascunho, ins = inscritos(r.jogoId);
    const lin = ins.map(i => Object.assign({}, i, { time: r.V.includes(i.id) ? 'V' : r.A.includes(i.id) ? 'A' : '' })).filter((i, k) => i.time !== ins[k].time);
    fazer(async () => {
      if (lin.length) await salvar('Inscricoes', lin);
      const j = jogo(r.jogoId); if (j.status === 'aberta') await salvar('Jogos', Object.assign({}, j, { status: 'fechada' }));
      st.rascunho = null; render(); toast('Times salvos! ⚽');
    });
  },

  golT: d => { st.res[d.id] = Math.max(0, st.res[d.id] + num(d.d)); render(); },
  golJ: d => { st.res.g[d.id] = Math.max(0, (st.res.g[d.id] || 0) + num(d.d)); render(); },
  salvarRes: () => {
    const r = st.res, j = jogo(r.jogoId);
    const lin = inscritos(j.id).filter(i => i.time && String(num(i.gols)) !== String(r.g[i.id] || 0)).map(i => Object.assign({}, i, { gols: r.g[i.id] || 0 }));
    fazer(async () => {
      if (lin.length) await salvar('Inscricoes', lin);
      await salvar('Jogos', Object.assign({}, j, { golsVermelho: r.V, golsAzul: r.A, status: 'encerrada', votacao: j.votacao || 'aberta' }));
      st.res = null; st.jogoTab = 'votacao'; render(); toast('Resultado salvo! Votação aberta 🗳️');
    });
  },
  votar: d => {
    const j = jogo(d.id), ins = inscritos(j.id).filter(i => i.time && i.jogadorId && i.jogadorId !== st.user.id);
    const atual = (D().Votos || []).find(v => v.jogoId === j.id && v.eleitorId === st.user.id) || {};
    const ops = sel => ins.map(i => `<option value="${i.jogadorId}" ${sel === i.jogadorId ? 'selected' : ''}>${esc(nomeI(i))} ${i.time === 'V' ? '🔴' : '🔵'}</option>`).join('');
    modal('Votação ' + fcurta(j.data), `<label class="f"><span>⭐ Bola cheia (craque do jogo)</span><select class="in" id="vc"><option value="">—</option>${ops(atual.craqueId)}</select></label>
      <label class="f"><span>🎈 Bola murcha</span><select class="in" id="vm"><option value="">—</option>${ops(atual.murchaId)}</select></label>
      <div class="tiny" style="margin-bottom:14px">O voto é aberto: todos veem quem votou em quem. Não dá para votar em você mesmo. Dá para mudar o voto até a votação ser encerrada.</div><button class="btn pri full" data-act="votarOk" data-id="${j.id}">${atual.id ? 'Salvar novo voto' : 'Confirmar voto'}</button>`);
  },
  votarOk: d => {
    const c = $('#vc').value, m = $('#vm').value; if (!c && !m) return toast('Escolha pelo menos um', true);
    fechar(); fazer(() => salvar('Votos', { id: 'v_' + d.id + '_' + st.user.id, jogoId: d.id, eleitorId: st.user.id, craqueId: c, murchaId: m }, 'Voto salvo! 🗳️'));
  },
  fecharVot: () => {
    const j = jogo(st.jogoId), votos = D().Votos.filter(v => v.jogoId === j.id);
    const win = f => { const c = {}; votos.forEach(v => { if (v[f]) c[v[f]] = (c[v[f]] || 0) + 1; }); const mx = Math.max(0, ...Object.values(c)); return Object.keys(c).filter(k => c[k] === mx && mx > 0).join(','); };
    if (!confirmar('Encerrar a votação? Empates premiam todos os empatados.')) return;
    fazer(() => salvar('Jogos', Object.assign({}, j, { votacao: 'fechada', craqueIds: win('craqueId'), murchaIds: win('murchaId') }), 'Votação encerrada'));
  },
  retirarVoto: d => { if (!confirmar('Retirar seu voto?')) return; fazer(() => excluir('Votos', d.id, 'Voto retirado')); },
  definirCraque: () => {
    const j = jogo(st.jogoId), ins = inscritos(j.id).filter(i => i.time && i.jogadorId);
    const ops = sel => `<option value="">—</option>` + ins.map(i => `<option value="${i.jogadorId}" ${csv(sel).includes(i.jogadorId) ? 'selected' : ''}>${esc(nomeI(i))}</option>`).join('');
    modal('Bola cheia e bola murcha', `<label class="f"><span>⭐ Bola cheia</span><select class="in" id="dc">${ops(j.craqueIds)}</select></label>
      <label class="f"><span>🎈 Bola murcha</span><select class="in" id="dm">${ops(j.murchaIds)}</select></label>
      <button class="btn pri full" data-act="definirOk">Salvar</button>`);
  },
  definirOk: () => { const j = jogo(st.jogoId), c = $('#dc').value, m = $('#dm').value; fechar();
    fazer(() => salvar('Jogos', Object.assign({}, j, { craqueIds: c, murchaIds: m, votacao: 'fechada' }), 'Salvo')); },

  quitar: d => {
    if (d.tipo === 'jogo') return ACT.pago(d);
    if (d.tipo === 'evento') return ACT.pagoEv(d);
    const c = D().Cobrancas.find(x => x.id === d.id);
    fazer(() => salvar('Cobrancas', Object.assign({}, c, { pago: c.valor }), 'Marcado como pago'));
  },
  editSaldo: () => modal('Saldo inicial', `<form><label class="f"><span>Data</span><input class="in" type="date" name="d" value="${cfg('saldoInicialData')}"></label>
      <label class="f"><span>Saldo nessa data (R$)</span>${campoMoeda('v', cfg('saldoInicial'))}</label>
      <button type="button" class="btn pri full" data-act="editSaldoOk">Salvar</button></form>`),
  editSaldoOk: (d, el) => { const f = formDados(el.closest('form')); fechar();
    fazer(() => salvar('Config', [{ id: 'saldoInicialData', valor: f.d }, { id: 'saldoInicial', valor: num(f.v) }], 'Saldo atualizado')); },
  editArrec: d => { const j = jogo(d.id);
    modal('Jogo ' + fcurta(j.data), `<form><label class="f"><span>Arrecadado (deixe vazio para somar os ✅)</span>${campoMoeda('a', j.arrecadadoManual)}</label>
      <label class="f"><span>Quadra (R$)</span>${campoMoeda('q', j.quadra)}</label>
      <button type="button" class="btn pri full" data-act="editArrecOk" data-id="${j.id}">Salvar</button></form>`); },
  editArrecOk: (d, el) => { const f = formDados(el.closest('form')), j = jogo(d.id); fechar();
    fazer(() => salvar('Jogos', Object.assign({}, j, { arrecadadoManual: blank(f.a) ? '' : num(f.a), quadra: num(f.q), obs: !blank(f.a) && yes(j.legado) ? '' : j.obs }), 'Salvo')); },
  editLanc: d => { const c = d.id ? D().Caixa.find(x => x.id === d.id) : { data: hoje(), descricao: '', valor: '' };
    modal(d.id ? 'Lançamento' : 'Novo lançamento', `<form><input type="hidden" name="id" value="${esc(c.id || '')}">
      <label class="f"><span>Descrição</span><input class="in" name="descricao" value="${esc(c.descricao)}" placeholder="Ex.: Troféu, bolas, coletes"></label>
      <label class="f"><span>Data</span><input class="in" type="date" name="data" value="${esc(c.data)}"></label>
      <div class="grid2"><label class="f"><span>Tipo</span><select class="in" name="tipo"><option value="saida" ${num(c.valor) <= 0 ? 'selected' : ''}>Saída (gasto)</option><option value="entrada" ${num(c.valor) > 0 ? 'selected' : ''}>Entrada</option></select></label>
      <label class="f"><span>Valor</span>${campoMoeda('valor', blank(c.valor) ? '' : Math.abs(num(c.valor)))}</label></div>
      <div class="btns"><button type="button" class="btn pri grow" data-act="salvarGen" data-tab="Caixa">Salvar</button>${d.id ? `<button type="button" class="btn danger" data-act="excluirGen" data-tab="Caixa" data-id="${d.id}">Excluir</button>` : ''}</div></form>`); },
  editCob: d => { const c = d.id ? D().Cobrancas.find(x => x.id === d.id) : { categoria: 'Uniforme 2026', pessoa: '', item: '', valor: '', pago: 0, recebedor: '', obs: '' };
    const cats = [...new Set((D().Cobrancas || []).map(x => x.categoria))];
    modal(d.id ? 'Cobrança' : 'Nova cobrança', `<form><input type="hidden" name="id" value="${esc(c.id || '')}">
      <label class="f"><span>Categoria</span><input class="in" name="categoria" list="cats" value="${esc(c.categoria)}"><datalist id="cats">${cats.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <label class="f"><span>Pessoa</span><input class="in" name="pessoa" value="${esc(c.pessoa)}"></label>
      <label class="f"><span>Item</span><input class="in" name="item" value="${esc(c.item)}" placeholder="Camisa, casaco, bermuda..."></label>
      <div class="grid2"><label class="f"><span>Valor</span>${campoMoeda('valor', c.valor)}</label>
      <label class="f"><span>Já pago</span>${campoMoeda('pago', c.pago)}</label></div>
      <label class="f"><span>Quem recebeu</span><input class="in" name="recebedor" value="${esc(c.recebedor)}"></label>
      <label class="f"><span>Observação</span><input class="in" name="obs" value="${esc(c.obs)}"></label>
      <div class="btns"><button type="button" class="btn pri grow" data-act="salvarGen" data-tab="Cobrancas">Salvar</button>${d.id ? `<button type="button" class="btn danger" data-act="excluirGen" data-tab="Cobrancas" data-id="${d.id}">Excluir</button>` : ''}</div></form>`); },
  editPatro: d => { const p = d.id ? D().Patrocinios.find(x => x.id === d.id) : { ano: new Date().getFullYear(), empresa: '', valor: '', status: 'negociacao' };
    modal(d.id ? 'Patrocinador' : 'Novo patrocinador', `<form><input type="hidden" name="id" value="${esc(p.id || '')}">
      <label class="f"><span>Empresa</span><input class="in" name="empresa" value="${esc(p.empresa)}"></label>
      <div class="grid2"><label class="f"><span>Valor</span>${campoMoeda('valor', p.valor)}</label>
      <label class="f"><span>Ano</span><input class="in" name="ano" inputmode="numeric" value="${esc(p.ano)}"></label></div>
      <label class="f"><span>Situação</span><select class="in" name="status">${[['pago', 'Pago'], ['negociacao', 'Em negociação'], ['interesse', 'Interesse']].map(([v, l]) => `<option value="${v}" ${p.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="btns"><button type="button" class="btn pri grow" data-act="salvarGen" data-tab="Patrocinios">Salvar</button>${d.id ? `<button type="button" class="btn danger" data-act="excluirGen" data-tab="Patrocinios" data-id="${d.id}">Excluir</button>` : ''}</div></form>`); },
  salvarGen: (d, el) => {
    const f = formDados(el.closest('form')); if (!f.id) delete f.id;
    ['valor', 'pago'].forEach(k => { if (k in f) f[k] = num(f[k]); });
    if ('tipo' in f) { f.valor = f.tipo === 'saida' ? -Math.abs(f.valor) : Math.abs(f.valor); delete f.tipo; }
    const ant = f.id ? (D()[d.tab] || []).find(x => x.id === f.id) : {};
    fechar(); fazer(() => salvar(d.tab, Object.assign({}, ant, f), 'Salvo'));
  },
  excluirGen: d => { if (!confirmar('Excluir este item?')) return; fechar(); fazer(() => excluir(d.tab, d.id, 'Excluído')); },

  abrirEvento: d => { st.eventoId = d.id; render(); scrollTo(0, 0); },
  voltarEv: () => voltar(),
  voltar: () => voltar(),
  editEvento: d => { const e = d.id ? D().Eventos.find(x => x.id === d.id) : { nome: '', data: hoje(), valor: '', status: 'aberto', obs: '' };
    modal(d.id ? 'Editar evento' : 'Novo evento', `<form><input type="hidden" name="id" value="${esc(e.id || '')}">
      <label class="f"><span>Nome</span><input class="in" name="nome" value="${esc(e.nome)}" placeholder="Churrasco, confraternização..."></label>
      <div class="grid2"><label class="f"><span>Data</span><input class="in" type="date" name="data" value="${esc(e.data)}"></label>
      <label class="f"><span>Valor fixo por pessoa</span>${campoMoeda('valor', e.valor)}</label></div>
      <div class="tiny" style="margin:-4px 0 12px">Se você lançar gastos, o app divide o total entre os participantes e esse valor fixo deixa de valer.</div>
      <label class="f"><span>Observação</span><input class="in" name="obs" value="${esc(e.obs)}"></label>
      <label class="f"><span>Situação</span><select class="in" name="status"><option value="aberto" ${e.status === 'aberto' ? 'selected' : ''}>Aberto</option><option value="encerrado" ${e.status !== 'aberto' ? 'selected' : ''}>Encerrado</option></select></label>
      <div class="btns"><button type="button" class="btn pri grow" data-act="salvarEv">Salvar</button>${d.id ? `<button type="button" class="btn danger" data-act="excluirEv" data-id="${d.id}">Excluir</button>` : ''}</div></form>`); },
  salvarEv: (d, el) => { const f = formDados(el.closest('form')); if (!f.id) delete f.id; f.valor = num(f.valor); fechar();
    fazer(async () => { const r = await salvar('Eventos', f, 'Evento salvo'); st.eventoId = r.linhas[0].id; render(); }); },
  excluirEv: d => { if (!confirmar('Excluir o evento com participantes e gastos?')) return; fechar();
    fazer(async () => {
      const ps = D().EventoParticipantes.filter(p => p.eventoId === d.id).map(p => p.id), gs = (D().EventoGastos || []).filter(g => g.eventoId === d.id).map(g => g.id);
      if (ps.length) await excluir('EventoParticipantes', ps); if (gs.length) await excluir('EventoGastos', gs);
      await excluir('Eventos', d.id, 'Evento excluído'); st.eventoId = null; render();
    }); },
  entrarEv: () => fazer(() => salvar('EventoParticipantes', { eventoId: st.eventoId, jogadorId: st.user.id, nomeAvulso: '', valor: '', pago: 'N' }, 'Confirmado! 🎉')),
  sairEv: d => { if (confirmar('Desmarcar presença?')) fazer(() => excluir('EventoParticipantes', d.id, 'Presença removida')); },
  tirarEv: d => { if (confirmar('Remover participante?')) fazer(() => excluir('EventoParticipantes', d.id, 'Removido')); },
  pagoEv: d => fazer(() => {
    const p = D().EventoParticipantes.find(x => x.id === d.id), e = D().Eventos.find(x => x.id === p.eventoId), dev = devidoEv(e, p);
    if (!yes(p.pago)) return salvar('EventoParticipantes', Object.assign({}, p, { pago: 'S', valorPago: dev }), `${nomeI(p)} pagou ${brl(dev)}`);
    if (faltaEv(e, p) > 0) return salvar('EventoParticipantes', Object.assign({}, p, { valorPago: dev }), `Complemento de ${nomeI(p)} recebido`);
    return salvar('EventoParticipantes', Object.assign({}, p, { pago: 'N', valorPago: '' }), 'Pagamento desmarcado');
  }),
  addPart: () => {
    const ja = D().EventoParticipantes.filter(p => p.eventoId === st.eventoId).map(p => p.jogadorId);
    const ops = D().Jogadores.filter(x => yes(x.ativo) && !ja.includes(x.id)).sort((a, b) => a.apelido.localeCompare(b.apelido));
    modal('Adicionar participante', `<form><label class="f"><span>Jogador</span><select class="in" name="jogadorId"><option value="">— convidado —</option>${ops.map(o => `<option value="${o.id}">${esc(o.apelido)}</option>`).join('')}</select></label>
      <label class="f"><span>Nome do convidado</span><input class="in" name="nomeAvulso"></label>
      <label class="f"><span>Valor diferente (opcional)</span>${campoMoeda('valor', '')}</label>
      <button type="button" class="btn pri full" data-act="addPartOk">Adicionar</button></form>`);
  },
  addPartOk: (d, el) => { const f = formDados(el.closest('form')); if (!f.jogadorId && !f.nomeAvulso.trim()) return toast('Escolha ou digite um nome', true);
    if (f.jogadorId) f.nomeAvulso = ''; f.valor = blank(f.valor) ? '' : num(f.valor); fechar();
    fazer(() => salvar('EventoParticipantes', Object.assign(f, { eventoId: st.eventoId, pago: 'N' }), 'Adicionado')); },
  editGasto: d => { const g = d.id ? D().EventoGastos.find(x => x.id === d.id) : { descricao: '', valor: '' };
    modal('Gasto', `<form><input type="hidden" name="id" value="${esc(g.id || '')}"><input type="hidden" name="eventoId" value="${st.eventoId}">
      <label class="f"><span>Descrição</span><input class="in" name="descricao" value="${esc(g.descricao)}" placeholder="Carne, bebida, carvão..."></label>
      <label class="f"><span>Valor</span>${campoMoeda('valor', g.valor)}</label>
      <div class="btns"><button type="button" class="btn pri grow" data-act="salvarGen" data-tab="EventoGastos">Salvar</button>${d.id ? `<button type="button" class="btn danger" data-act="excluirGen" data-tab="EventoGastos" data-id="${d.id}">Excluir</button>` : ''}</div></form>`); },

  verJog: d => { fechar(); st.voltar = st.tab === 'jogador' ? st.voltar : st.tab; st.jogadorId = d.id; st.tab = 'jogador'; render(); scrollTo(0, 0); },
  perfil: () => ACT.verJog({ id: st.user.id }),
  voltarJog: () => voltar(),
  verMidia: d => verMidia(d.id),
  excluirMidia: d => { if (!confirmar('Excluir esta mídia?')) return; fechar();
    fazer(async () => { await api('excluirMidia', { id: d.id }); st.d.Midias = st.d.Midias.filter(m => m.id !== d.id); render(); toast('Mídia excluída'); }); },
  enviarMidia: async (d, el) => {
    const m = el.closest('.modal'), leg = $('#ml', m).value.trim(), arq = m._arq;
    el.disabled = true; el.textContent = 'Enviando... não feche o app';
    try {
      const r = await api('enviarMidia', { jogadorId: m._jog, mime: arq.mime, dados: arq.b64, legenda: leg });
      (st.d.Midias = st.d.Midias || []).push(r.linha); fechar(); render(); toast('Mídia publicada 📸');
    } catch (e) { el.disabled = false; el.textContent = 'Publicar'; toast(e.message, true); }
  },
  editJog: d => {
    const j = d.id ? J(d.id) : { apelido: '', nome: '', posicao: 'linha', nota: 1, peso: 80, papel: 'jogador', ativo: 'S' };
    modal(d.id ? 'Editar jogador' : 'Novo jogador', `<form><input type="hidden" name="id" value="${esc(j.id || '')}">
      <div class="grid2"><label class="f"><span>Apelido</span><input class="in" name="apelido" value="${esc(j.apelido)}"></label>
      <label class="f"><span>Nome</span><input class="in" name="nome" value="${esc(j.nome)}"></label></div>
      <div class="grid2"><label class="f"><span>Posição</span><select class="in" name="posicao"><option value="linha">Linha</option><option value="goleiro" ${j.posicao === 'goleiro' ? 'selected' : ''}>Goleiro</option></select></label>
      <label class="f"><span>Acesso</span><select class="in" name="papel"><option value="jogador">Jogador</option><option value="admin" ${j.papel === 'admin' ? 'selected' : ''}>Administrador</option></select></label></div>
      <div class="grid2"><label class="f"><span>Nota (0,5 a 2)</span><input class="in" name="nota" inputmode="decimal" value="${esc(j.nota)}"></label>
      <label class="f"><span>Peso (kg)</span><input class="in" name="peso" inputmode="numeric" value="${esc(j.peso)}"></label></div>
      <label class="f"><span>Situação</span><select class="in" name="ativo"><option value="S">Ativo</option><option value="N" ${j.ativo === 'N' ? 'selected' : ''}>Inativo</option></select></label>
      <div class="tiny" style="margin-bottom:12px">A nota e o peso só aparecem para administradores e servem para equilibrar os times.</div>
      <button type="button" class="btn pri full" data-act="salvarJog">Salvar</button></form>`);
  },
  salvarJog: (d, el) => {
    const f = formDados(el.closest('form')); if (!f.apelido.trim()) return toast('Informe o apelido', true);
    if (!f.id) delete f.id; f.nota = num(f.nota); f.peso = num(f.peso);
    const ant = f.id ? J(f.id) : {}; fechar();
    fazer(async () => {
      const r = await salvar('Jogadores', Object.assign({}, ant, f), 'Jogador salvo');
      if (r.extra && r.extra.senhaTemp) mostrarAcesso(f.apelido, r.extra.login, r.extra.senhaTemp);
    });
  },
  resetSenha: d => { if (!confirmar('Gerar uma nova senha temporária? A senha atual deixa de funcionar.')) return;
    fazer(async () => { const r = await api('resetarSenha', { jogadorId: d.id }); mostrarAcesso(J(d.id).apelido, r.login, r.senhaTemp); }); },
  inativos: () => { st.inativos = !st.inativos; render(); },
  pdf: (d, el) => fazer(async () => {
    if (el) { el.disabled = true; el.textContent = 'Gerando...'; }
    pensar(true); await new Promise(r => setTimeout(r, 30));
    try {
    const ult = jogosOrd().filter(temResultado).pop();
    const f1 = v => v.toFixed(1).replace('.', ',');
    const rel = {
      titulo: 'ENTREVERO FUTSAL CLUBE', sub: `RODADA-${rodadaAtual()}  •  ${fdata(ult ? ult.data : hoje())}`,
      rodape: 'VITÓRIA = 3 • EMPATE = 1 • DERROTA = 0 — gerado pelo app em ' + fdata(hoje()),
      colunas: [
        { titulo: 'ARTILHARIA', cab: ['', 'Jogador', 'Gols'], linhas: ranking('gols').map(s => [s.pos, J(s.id).apelido, s.gols]) },
        { titulo: 'BOLA CHEIA', cab: ['', 'Jogador', 'Vezes'], linhas: ranking('craques').map(s => [s.pos, J(s.id).apelido, s.craques]) },
        { titulo: 'GOLEIRO MENOS VAZADO', cab: ['', 'Goleiro', 'Gols', 'Jogos', 'Média'], linhas: ranking('media').map(s => [s.pos, J(s.id).apelido, s.gs, s.jg, f1(s.media)]) },
        { titulo: 'PONTUAÇÃO GERAL', cab: ['', 'Jogador', 'Pts'], linhas: ranking('pontos').map(s => [s.pos, J(s.id).apelido, s.pontos]) }
      ],
      extras: [
        { titulo: 'BOLA MURCHA', cab: ['Posição', 'Jogador', 'Vezes'], larguras: [.15, .6, .25], linhas: ranking('murchas').map(s => [s.pos + 'º', J(s.id).apelido, String(s.murchas)]) },
        { titulo: 'ÚLTIMAS RODADAS', cab: ['Rodada', 'Data', 'Placar', 'Vermelho', 'Azul', 'Bola cheia / murcha'], larguras: [.07, .07, .07, .32, .32, .15],
          linhas: rodadasApp().reverse().slice(0, 10).map(r => { const ins = inscritos(r.j.id).filter(i => i.time);
            const t = x => ins.filter(i => i.time === x).map(i => nomeI(i) + (num(i.gols) ? ` (${i.gols})` : '')).join(', ');
            return [String(r.n), fcurta(r.j.data), `${r.j.golsVermelho} x ${r.j.golsAzul}`, t('V'), t('A'),
              (csv(r.j.craqueIds).map(id => J(id)?.apelido).join(', ') || '—') + ' / ' + (csv(r.j.murchaIds).map(id => J(id)?.apelido).join(', ') || '—')]; }) }
      ]
    };
    var esc = $('.top img.crest')?.src || 'icons/escudo.png';
    var nome = `Entrevero_Rodada-${rodadaAtual()}`;
    var blob = await EfcPDF.relatorio(rel, esc);
    var imgs = await EfcPDF.relatorio(rel, esc, true);
    } finally { pensar(false); if (el) { el.disabled = false; el.textContent = '📄 Exportar PDF'; } }
    if (el) { el.disabled = false; el.textContent = '📄 Exportar PDF'; }
    const url = URL.createObjectURL(blob);
    const arq = (() => { try { return new File([blob], nome + '.pdf', { type: 'application/pdf' }); } catch (e) { return null; } })();
    const pngs = imgs.map((u, n) => { try { const b = atob(u.split(',')[1]), a8 = new Uint8Array(b.length); for (let q = 0; q < b.length; q++) a8[q] = b.charCodeAt(q);
      return new File([a8], `${nome}${imgs.length > 1 ? '_' + (n + 1) : ''}.png`, { type: 'image/png' }); } catch (e) { return null; } }).filter(Boolean);
    const pode = f => { try { return !!(navigator.canShare && f.length && navigator.canShare({ files: f })); } catch (e) { return false; } };
    modal('Tabelas prontas 📄', `<div class="btns" style="flex-direction:column;margin-bottom:12px">
        ${pode([arq]) ? '<button class="btn pri full" data-act="pdfShare" data-k="pdf">📲 Compartilhar PDF</button>' : ''}
        ${pode(pngs) ? '<button class="btn full" data-act="pdfShare" data-k="png">🖼️ Compartilhar como imagem</button>' : ''}
        <a class="btn full ${pode([arq]) ? '' : 'pri'}" style="text-decoration:none" href="${url}" download="${nome}.pdf">⬇️ Baixar PDF</a></div>
      <div class="small muted" style="margin-bottom:8px">Se os botões não abrirem no seu celular, <b>segure o dedo na imagem</b> e escolha salvar ou compartilhar:</div>
      ${imgs.map(u => `<img src="${u}" alt="Tabelas" style="width:100%;border-radius:8px;margin-bottom:8px;background:#fff">`).join('')}`, m => { m._arq = arq; m._pngs = pngs; });
  }),
  pdfShare: (d, el) => { const m = el.closest('.modal'), f = d.k === 'png' ? m._pngs : [m._arq];
    navigator.share({ files: f, title: 'Tabelas Entrevero' }).catch(e => { if (e && e.name !== 'AbortError') toast('Não deu para compartilhar aqui. Segure o dedo na imagem.', true); }); },
  salvarCfg: (d, el) => {
    const f = formDados(el.closest('form'));
    fazer(() => salvar('Config', Object.entries(f).map(([id, valor]) => ({ id, valor: String(valor).trim() })), 'Configurações salvas'));
  },
  editModelo: d => {
    const m = MODELOS[d.id];
    modal(m.nome, `<textarea class="in" id="tplTxt" style="min-height:220px;font:13px/1.45 ui-monospace,Menlo,monospace">${esc(modelo(d.id))}</textarea>
      ${m.vars.length ? `<div class="tiny" style="margin:10px 0 6px">Toque para inserir:</div><div class="row wrap" style="gap:6px">${m.vars.map(v => `<button class="chip or" style="border:0" data-act="insVar" data-v="{${v}}">{${v}}</button>`).join('')}</div>` : ''}
      <div class="btns" style="margin-top:14px"><button class="btn pri grow" data-act="salvarModelo" data-id="${d.id}">Salvar</button><button class="btn ghost" data-act="restaurarModelo" data-id="${d.id}">Restaurar padrão</button></div>`);
  },
  insVar: d => { const t = $('#tplTxt'), a = t.selectionStart ?? t.value.length; t.value = t.value.slice(0, a) + d.v + t.value.slice(t.selectionEnd ?? a); t.focus(); t.selectionStart = t.selectionEnd = a + d.v.length; },
  salvarModelo: d => { const v = $('#tplTxt').value; fechar(); fazer(() => salvar('Config', { id: 'tpl_' + d.id, valor: v === MODELOS[d.id].padrao ? '' : v }, 'Modelo salvo ✍️')); },
  restaurarModelo: d => { if (!confirmar('Voltar este texto para o padrão?')) return; fechar(); fazer(() => salvar('Config', { id: 'tpl_' + d.id, valor: '' }, 'Modelo restaurado')); },
  notifAbrir: () => { fechar(); telaNotif(); },
  demoEntrar: (d, el) => { const f = $('#lf'); f.login.value = d.u; f.senha.value = 'demo'; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit')); },
  demoGuiaOk: () => { try { localStorage.setItem('efc_demo_guia_ok', '1'); } catch (e) { } render(); },
  demoGuia: () => { fechar(); try { localStorage.removeItem('efc_demo_guia_ok'); } catch (e) { } st.tab = 'inicio'; render(); scrollTo(0, 0); },
  demoTrocar: () => { const u = admin() ? 'matheus' : 'emax'; st.tab = 'inicio'; sair(); setTimeout(() => ACT.demoEntrar({ u }), 50); },
  demoReset: () => { try { Object.keys(localStorage).filter(k => k.startsWith('efc_')).forEach(k => localStorage.removeItem(k)); } catch (e) { } location.reload(); },
  notifDica: () => { try { localStorage.setItem('efc_notif_dica', '1'); } catch (e) { } render(); },
  notifLigar: (d, el) => { el.disabled = true; el.textContent = 'Ativando...';
    ligarNotif().then(async () => { const r = await api('testarAviso').catch(() => null); telaNotif(); render(); toast(r ? 'Notificações ativadas! Chegou um teste 🔔' : 'Notificações ativadas! 🔔'); })
      .catch(e => { el.disabled = false; el.textContent = '🔔 Ativar notificações'; toast(e.message || String(e), true); estadoNotif().then(x => { st.notif = x; }); }); },
  notifDesligar: () => fazer(async () => { await desligarNotif(); telaNotif(); render(); toast('Notificações desativadas neste aparelho'); }),
  notifTeste: () => fazer(async () => { const r = await api('testarAviso'); toast(r.aparelhos ? 'Enviado! Deve chegar em instantes 📨' : 'Nenhum aparelho seu está cadastrado. Ative de novo.', !r.aparelhos); }),
  verAvisos: () => modal('🔔 Avisos', listaAvisos(30)),
  salvarNotifCfg: (d, el) => {
    const f = el.closest('form');
    fazer(() => salvar('Config', TIPOS_NOTIF.map(([k]) => ({ id: 'notif_' + k, valor: f.querySelector(`[name=notif_${k}]`).checked ? 'S' : 'N' })), 'Notificações salvas 🔔'));
  },
  meuGol: d => { const i = D().Inscricoes.find(x => x.id === d.id); const v = st.meusGols && st.meusGols.id === d.id ? st.meusGols.v : num(i.gols);
    st.meusGols = { id: d.id, v: Math.max(0, Math.min(30, v + num(d.d))) }; render(); },
  salvarMeuGol: d => { const i = D().Inscricoes.find(x => x.id === d.id), v = st.meusGols ? st.meusGols.v : num(i.gols);
    fazer(async () => { await salvar('Inscricoes', Object.assign({}, i, { gols: v }), 'Gols salvos! O time foi avisado ⚽'); st.meusGols = null; render(); }); },
  galF: d => { st.galFiltro = d.id; render(); }
};
function mostrarAcesso(nome, login, senha) {
  mostrarTexto('Acesso de ' + esc(nome), preencher('acesso', { NOME: nome, USUARIO: login, SENHA: senha, LINK: location.origin + location.pathname }));
}
function confirmar(m) { if (window.EFC_DEMO_GUIA) return true; try { return window.confirm(m); } catch (e) { return true; } }
function formJogo(j) {
  modal(j.id ? 'Editar jogo' : 'Nova lista', `<form><input type="hidden" name="id" value="${esc(j.id || '')}">
    <div class="grid2"><label class="f"><span>Data</span><input class="in" type="date" name="data" value="${esc(j.data)}"></label>
    <label class="f"><span>Hora</span><input class="in" name="hora" value="${esc(j.hora)}"></label></div>
    <div class="grid2"><label class="f"><span>Jogador R$</span>${campoMoeda('valorJogador', j.valorJogador)}</label>
    <label class="f"><span>Goleiro R$</span>${campoMoeda('valorGoleiro', j.valorGoleiro)}</label></div>
    <label class="f"><span>Quadra R$</span>${campoMoeda('quadra', j.quadra)}</label>
    <label class="f"><span>Situação</span><select class="in" name="status">${[['aberta', 'Lista aberta'], ['fechada', 'Lista fechada'], ['encerrada', 'Encerrado']].map(([v, l]) => `<option value="${v}" ${j.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="btns"><button type="button" class="btn pri grow" data-act="salvarJogo">${j.id ? 'Salvar' : 'Abrir lista'}</button>
      ${j.id ? (yes(j.arquivado) ? `<button type="button" class="btn" data-act="desarquivarJogo" data-id="${j.id}">Desarquivar</button>` : `<button type="button" class="btn" data-act="arquivarJogo" data-id="${j.id}">🗄️ Arquivar</button>`) : ''}</div>
    ${j.id ? (travaJogo(j) ? `<div class="tiny" style="margin-top:12px">🔒 Este jogo não pode ser excluído (já tem ${travaJogo(j)}). Arquivar tira da tela e guarda tudo.</div>`
      : `<button type="button" class="btn ghost full" style="margin-top:10px;color:var(--red)" data-act="excluirJogo" data-id="${j.id}">Excluir lista (só se foi criada por engano)</button>`) : ''}</form>`);
}

/* addInscOk usa a caixa "goleiro" */
ACT.addInscOk = () => {
  const id = $('#aj').value, nome = $('#an').value.trim(), gk = $('#ag').checked ? 'S' : 'N';
  if (!id && !nome) return toast('Escolha um jogador ou digite o nome', true);
  const ord = Math.max(0, ...inscritos(st.jogoId).map(i => num(i.ordem))) + 1;
  fechar();
  fazer(() => salvar('Inscricoes', { jogoId: st.jogoId, jogadorId: id, nomeAvulso: id ? '' : nome, goleiro: gk, ordem: ord, time: '', gols: '', pago: 'N', valor: '' }, 'Adicionado'));
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return;
  const f = ACT[el.dataset.act]; if (!f) return;
  e.preventDefault();
  const antes = st.d ? snapNav() : null, chave = st.d ? chaveNav() : null;
  f(el.dataset, el);
  if (antes && st.d && chaveNav() !== chave && !['voltar', 'voltarJog', 'voltarEv', 'sair', 'demoTrocar', 'demoReset'].includes(el.dataset.act)) empilhar(antes);
});

/* ================= VOLTAR (botão, gesto e voltar do Android) ================= */
const NAV = { pilha: [] };
const HIST = () => !DEMO && !!(window.history && history.pushState);
const snapNav = () => JSON.stringify({ tab: st.tab, jogoId: st.jogoId, jogoTab: st.jogoTab, tabTab: st.tabTab, granaTab: st.granaTab, eventoId: st.eventoId, jogadorId: st.jogadorId, voltar: st.voltar });
const chaveNav = () => [st.tab, st.eventoId || '', st.tab === 'jogador' ? st.jogadorId : ''].join('|');
function empilhar(sn) {
  NAV.pilha.push(sn); if (NAV.pilha.length > 40) NAV.pilha.shift();
  if (HIST()) { try { history.pushState({ efc: NAV.pilha.length }, ''); } catch (e) { } }
  atualizarVoltar();
}
const podeVoltar = () => !!$('#modal') || NAV.pilha.length > 0 || (st.d && st.tab !== 'inicio');
function voltarInterno() {
  if ($('#modal')) { fechar(); return; }
  const sn = NAV.pilha.pop();
  if (sn) { Object.assign(st, JSON.parse(sn)); }
  else if (st.tab !== 'inicio') { st.tab = 'inicio'; st.eventoId = null; }
  st.rascunho = null; st.res = null; render(); scrollTo(0, 0); atualizarVoltar();
}
function voltar() {
  if ($('#modal')) { fechar(); return; }
  if (HIST() && NAV.pilha.length && history.state && history.state.efc) history.back();
  else voltarInterno();
}
window.addEventListener('popstate', () => {
  if (!st.d) return;
  if ($('#modal')) { fechar(); if (HIST() && NAV.pilha.length) { try { history.pushState({ efc: NAV.pilha.length }, ''); } catch (e) { } } return; }
  voltarInterno();
});
function atualizarVoltar() { const b = $('#btnVoltar'); if (b) b.classList.toggle('hidden', !(NAV.pilha.length > 0 || (st.d && st.tab !== 'inicio'))); }

/* gesto: arrastar da borda esquerda para a direita */
let gesto = null;
document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || !st.d) return;
  const t = e.touches[0];
  if (t.clientX > 40 || !podeVoltar()) return;
  gesto = { x: t.clientX, y: t.clientY, dx: 0, t: Date.now(), ativo: false };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!gesto) return;
  const t = e.touches[0], dx = t.clientX - gesto.x, dy = t.clientY - gesto.y;
  if (!gesto.ativo) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > dx) { gesto = null; return; }
    if (dx < 12) return;
    gesto.ativo = true; gesto.alvo = $('#modal .sheet') || $('#main');
    if (!gesto.alvo) { gesto = null; return; }
    gesto.alvo.style.transition = 'none'; document.body.classList.add('arrastando');
  }
  gesto.dx = Math.max(0, dx);
  gesto.alvo.style.transform = `translateX(${gesto.dx}px)`;
  gesto.alvo.style.opacity = String(1 - Math.min(0.45, gesto.dx / 900));
  e.preventDefault();
}, { passive: false });
function fimGesto() {
  if (!gesto) return;
  const g = gesto; gesto = null; document.body.classList.remove('arrastando');
  if (!g.ativo) return;
  const vel = g.dx / Math.max(1, Date.now() - g.t), vai = g.dx > innerWidth * 0.3 || (vel > 0.5 && g.dx > 40);
  g.alvo.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
  if (!vai) { g.alvo.style.transform = ''; g.alvo.style.opacity = ''; return; }
  g.alvo.style.transform = `translateX(${innerWidth}px)`; g.alvo.style.opacity = '0';
  setTimeout(() => {
    g.alvo.style.transition = 'none'; g.alvo.style.transform = ''; g.alvo.style.opacity = '';
    voltar();
    const m = $('#main'); if (!m) return;
    m.style.transition = 'none'; m.style.transform = 'translateX(-28px)'; m.style.opacity = '.55';
    requestAnimationFrame(() => requestAnimationFrame(() => { m.style.transition = 'transform .2s ease-out, opacity .2s ease-out'; m.style.transform = ''; m.style.opacity = ''; }));
  }, 170);
}
document.addEventListener('touchend', fimGesto);
document.addEventListener('touchcancel', fimGesto);
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset && el.dataset.act === 'inativos') ACT.inativos();
  if (el.dataset && el.dataset.midia) {
    const file = el.files[0]; if (!file) return; el.value = '';
    prepararMidia(file).then(arq => {
      const prev = arq.mime.startsWith('video') ? `<video src="${arq.url}" controls playsinline style="width:100%;max-height:50vh;border-radius:12px;background:#000"></video>`
        : `<img src="${arq.url}" style="width:100%;max-height:50vh;object-fit:contain;border-radius:12px;background:#000">`;
      modal('Nova mídia de ' + esc(J(el.dataset.midia).apelido), `${prev}<label class="f" style="margin-top:12px"><span>Legenda (opcional)</span><input class="in" id="ml" maxlength="200" placeholder="Ex.: golaço de cobertura"></label>
        <button class="btn pri full" data-act="enviarMidia">Publicar</button>`, m => { m._arq = arq; m._jog = el.dataset.midia; });
    }).catch(e => toast(e.message, true));
  }
  if (el.dataset && el.dataset.foto) {
    const file = el.files[0]; if (!file) return;
    fazer(async () => {
      const url = await reduzirFoto(file);
      const r = await api('salvarFoto', { jogadorId: el.dataset.foto, foto: url });
      const j = J(el.dataset.foto); j.fotoVer = r.fotoVer; st.fotos[j.id] = url;
      const c = fotoCache(); c[j.id] = { v: String(r.fotoVer), url }; try { localStorage.setItem('efc_fotos', JSON.stringify(c)); } catch (x) { }
      fechar(); render(); toast('Foto atualizada 📷');
    });
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'busca') { st.busca = e.target.value; const p = e.target.selectionStart; render(); const b = $('#busca'); b.focus(); b.setSelectionRange(p, p); }
});

/* ================= login ================= */
function telaLogin(msg) {
  document.body.innerHTML = `${DEMO ? '<div class="demo">MODO DEMONSTRAÇÃO</div>' : ''}<div class="login"><img src="icons/escudo.png" alt="">
    <h1>Entrevero<br>Futsal Clube</h1><div class="kick" style="margin-top:6px">desde 2021</div>
    <form class="box" id="lf"><label class="f"><span>Usuário</span><input class="in" name="login" autocomplete="username" autocapitalize="none" placeholder="ex.: matheus"></label>
    <label class="f"><span>Senha</span><input class="in" type="password" name="senha" autocomplete="current-password"></label>
    ${msg ? `<div class="small" style="color:var(--red);margin-bottom:10px">${esc(msg)}</div>` : ''}
    <button class="btn pri full">Entrar</button>
    <div class="tiny" style="text-align:center;margin-top:14px">${window.EFC_DEMO_GUIA ? 'Na demonstração, use seu apelido (ex.: matheus, luis, victor) e a senha <b>demo</b>.' : 'Primeiro acesso? Use o usuário e a senha temporária que você recebeu.'}</div></form>
    ${window.EFC_DEMO_GUIA ? `<div class="box card" style="margin-top:18px"><div class="kick">Demonstração</div><b style="display:block;margin:4px 0 6px">Teste o app do time sem criar conta</b>
      <div class="small muted" style="margin-bottom:12px">Os dados são fictícios e o que você mexer fica só no seu celular.</div>
      <div class="btns" style="flex-direction:column"><button class="btn pri full" data-act="demoEntrar" data-u="${window.EFC_DEMO_SO_JOGADOR ? 'visitante' : 'matheus'}">⚽ Entrar como Jogador</button>
      ${window.EFC_DEMO_SO_JOGADOR ? '' : '<button class="btn full" data-act="demoEntrar" data-u="emax">🛠️ Entrar como Administrador</button>'}</div></div>` : ''}</div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Entrando...';
    try {
      const r = await api('login', f);
      st.token = r.token; try { localStorage.setItem(DEMO ? 'efc_token_demo' : 'efc_token', r.token); } catch (x) { } st.user = r.usuario; metaSW();
      if (r.trocarSenha) telaSenha(true, f.senha); else iniciar();
    } catch (err) { telaLogin(err.message); }
  };
}
function telaSenha(primeiro, atual) {
  const html = `<form id="sf">${primeiro ? `<p class="muted">Bem-vindo, <b>${esc(st.user.apelido)}</b>! Crie sua senha pessoal para os próximos acessos.</p>`
    : `<label class="f"><span>Senha atual</span><input class="in" type="password" name="atual"></label>`}
    <label class="f"><span>Nova senha</span><input class="in" type="password" name="nova" autocomplete="new-password"></label>
    <label class="f"><span>Repita a nova senha</span><input class="in" type="password" name="nova2" autocomplete="new-password"></label>
    <button class="btn pri full">Salvar senha</button></form>`;
  if (primeiro) {
    document.body.innerHTML = `<div class="login"><img src="icons/escudo.png" alt="" style="width:90px"><h1>Crie sua senha</h1><div class="box">${html}</div></div>`;
  } else modal('Trocar senha', html);
  $('#sf').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (f.nova !== f.nova2) return toast('As senhas não conferem', true);
    try { await api('trocarSenha', { atual: primeiro ? atual : f.atual, nova: f.nova }); toast('Senha salva 🔒'); if (primeiro) iniciar(); else fechar(); }
    catch (err) { toast(err.message, true); }
  };
}
function sair(silencioso) {
  const estava = !!st.d;
  if (!silencioso && !DEMO) desligarNotif().catch(() => { });
  st.token = ''; st.user = null; st.d = null; try { localStorage.removeItem(DEMO ? 'efc_token_demo' : 'efc_token'); } catch (x) { } fechar(); metaSW();
  telaLogin(silencioso && estava ? 'Sua sessão expirou. Entre novamente.' : '');
}
async function carregar(silencioso) {
  const r = await api('dados', {}, silencioso); st.d = r.dados; st.user = r.usuario;
  await carregarFotos(); render();
}
async function iniciar() {
  document.body.innerHTML = telaCarregando();
  try { await carregar(); } catch (e) { if (!st.token) return; document.body.innerHTML = `<div class="login"><p>${esc(e.message)}</p><button class="btn pri" onclick="location.reload()">Tentar de novo</button></div>`; return; }
  NAV.pilha = []; shell(); render();
  sincronizarNotif().then(() => render()).catch(() => { });
}
window.addEventListener('focus', () => { if (st.d && !$('#modal') && !st.rascunho && !st.res) carregar(true).catch(() => { }); });

if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('sw.js').catch(() => { });
if (st.token) iniciar(); else telaLogin();
