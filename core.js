/* ============================================================
   EFC – núcleo do servidor (regras, logins e permissões)
   Mesmo código roda no Google Apps Script e no modo demonstração.
   ============================================================ */

var TABELAS = {
  Jogadores: ['id','apelido','nome','posicao','nota','peso','login','papel','ativo','fotoVer','foto','senhaHash','senhaTemp','trocarSenha'],
  Historico: ['jogadorId','gols','craques','bolasMurchas','pontos','golsSofridos','jogosGoleiro'],
  Jogos: ['id','data','hora','status','valorJogador','valorGoleiro','quadra','golsVermelho','golsAzul','votacao','craqueIds','murchaIds','arrecadadoManual','legado','obs'],
  Inscricoes: ['id','jogoId','jogadorId','nomeAvulso','goleiro','ordem','time','gols','pago','valor'],
  Votos: ['id','jogoId','eleitorId','craqueId','murchaId'],
  Caixa: ['id','data','descricao','valor'],
  Config: ['id','valor'],
  Cobrancas: ['id','categoria','pessoa','item','valor','pago','recebedor','obs'],
  Patrocinios: ['id','ano','empresa','valor','status'],
  Eventos: ['id','nome','data','valor','status','obs'],
  EventoParticipantes: ['id','eventoId','jogadorId','nomeAvulso','valor','pago'],
  EventoGastos: ['id','eventoId','descricao','valor'],
  Midias: ['id','jogadorId','autorId','tipo','mime','arquivoId','legenda','data','jogoId'],
  Sessoes: ['id','jogadorId','criado']
};
var PRIVADOS = ['foto','senhaHash','senhaTemp'];

/* ---------- SHA-256 síncrono (sem dependências) ---------- */
function efcSha256(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  var str = unescape(encodeURIComponent(ascii));
  var words = [], ascLen = str.length * 8, hash = [], k = [], pc = 0, isC = {}, i, j;
  for (var c = 2; pc < 64; c++) {
    if (!isC[c]) { for (i = 0; i < 313; i += c) isC[i] = c;
      hash[pc] = (Math.pow(c, .5) * 4294967296) | 0; k[pc++] = (Math.pow(c, 1 / 3) * 4294967296) | 0; }
  }
  hash = hash.slice(0, 8); str += '\x80';
  while (str.length % 64 - 56) str += '\x00';
  for (i = 0; i < str.length; i++) { j = str.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
  words[words.length] = ((ascLen / 4294967296) | 0); words[words.length] = ascLen;
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16), oldHash = hash; hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
        (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  var out = '';
  for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; out += (b < 16 ? '0' : '') + b.toString(16); }
  return out;
}
function efcHash(login, senha) { return efcSha256('efc:' + String(login).toLowerCase() + ':' + senha); }

/* ---------- Servidor ---------- */
function EfcServer(store) {
  // store: { read(tab) -> [obj], upsert(tab,obj), remove(tab,id), uuid(), withLock(fn) }
  var S = this;

  function s(v) { return v === null || v === undefined ? '' : String(v); }
  function find(tab, id) { var r = store.read(tab); for (var i = 0; i < r.length; i++) if (s(r[i].id) === s(id)) return r[i]; return null; }
  function limpo(j) { var o = {}; for (var k in j) if (PRIVADOS.indexOf(k) < 0) o[k] = j[k]; return o; }
  function senhaTemp() { var c = 'abcdefghjkmnpqrstuvwxyz23456789', t = ''; for (var i = 0; i < 4; i++) t += c.charAt(Math.floor(Math.random() * c.length)); return 'efc' + t; }
  function erro(m) { throw new Error(m); }

  function usuario(token) {
    if (!token) erro('Faça login novamente.');
    var ses = find('Sessoes', token); if (!ses) erro('Sessão expirada. Faça login novamente.');
    var u = find('Jogadores', ses.jogadorId); if (!u || s(u.ativo) === 'N') erro('Acesso desativado.');
    return u;
  }
  function admin(u) { return s(u.papel) === 'admin'; }

  function jogou(jogoId, jogadorId) {
    return store.read('Inscricoes').some(function (i) { return s(i.jogoId) === s(jogoId) && s(i.jogadorId) === s(jogadorId) && s(i.time) !== ''; });
  }

  function podeSalvar(u, tab, novo, antigo) {
    if (tab === 'Sessoes') return false;
    if (admin(u)) return true;
    var mudou = function (campos) {
      return campos.some(function (k) { return s(novo[k]) !== s(antigo ? antigo[k] : ''); });
    };
    if (tab === 'Inscricoes') {
      if (s(novo.jogadorId) !== s(u.id)) return false;
      if (antigo && s(antigo.jogadorId) !== s(u.id)) return false;
      var j = find('Jogos', novo.jogoId); if (!j || s(j.status) !== 'aberta') return false;
      if (mudou(['time', 'gols', 'valor'])) return false;
      if (s(novo.pago) === 'S' && (!antigo || s(antigo.pago) !== 'S')) return false;
      return true;
    }
    if (tab === 'Votos') {
      if (s(novo.eleitorId) !== s(u.id)) return false;
      var jg = find('Jogos', novo.jogoId); if (!jg || s(jg.votacao) !== 'aberta') return false;
      if (!jogou(novo.jogoId, u.id)) return false;
      if (s(novo.craqueId) === s(u.id) || s(novo.murchaId) === s(u.id)) return false;
      return true;
    }
    if (tab === 'Midias') {
      if (!antigo || s(antigo.autorId) !== s(u.id)) return false;
      return !mudou(['jogadorId', 'autorId', 'tipo', 'mime', 'arquivoId', 'data']);
    }
    if (tab === 'EventoParticipantes') {
      if (s(novo.jogadorId) !== s(u.id)) return false;
      var ev = find('Eventos', novo.eventoId); if (!ev || s(ev.status) !== 'aberto') return false;
      if (antigo ? mudou(['pago', 'valor']) : (s(novo.pago) === 'S' || s(novo.valor) !== '')) return false;
      return true;
    }
    return false;
  }
  function podeExcluir(u, tab, antigo) {
    if (tab === 'Sessoes') return false;
    if (admin(u)) return true;
    if (tab === 'Inscricoes') {
      var j = find('Jogos', antigo.jogoId);
      return s(antigo.jogadorId) === s(u.id) && j && s(j.status) === 'aberta' && s(antigo.pago) !== 'S';
    }
    if (tab === 'EventoParticipantes') return s(antigo.jogadorId) === s(u.id) && s(antigo.pago) !== 'S';
    if (tab === 'Votos') { var jv = find('Jogos', antigo.jogoId); return s(antigo.eleitorId) === s(u.id) && jv && s(jv.votacao) === 'aberta'; }
    return false;
  }

  S.handle = function (req) {
    var a = req.action;

    if (a === 'login') {
      var login = s(req.login).trim().toLowerCase();
      var u = store.read('Jogadores').filter(function (j) { return s(j.login).toLowerCase() === login; })[0];
      if (!u || s(u.ativo) === 'N' || s(u.senhaHash) !== efcHash(login, s(req.senha))) erro('Usuário ou senha incorretos.');
      var token = store.uuid();
      store.upsert('Sessoes', { id: token, jogadorId: u.id, criado: new Date().toISOString() });
      return { token: token, usuario: limpo(u), trocarSenha: s(u.trocarSenha) === 'S' };
    }

    var me = usuario(req.token);

    if (a === 'eu') return { usuario: limpo(me), trocarSenha: s(me.trocarSenha) === 'S' };

    if (a === 'trocarSenha') {
      var nova = s(req.nova);
      if (nova.length < 4) erro('A nova senha precisa de pelo menos 4 caracteres.');
      if (s(me.senhaHash) !== efcHash(me.login, s(req.atual))) erro('Senha atual incorreta.');
      return store.withLock(function () {
        me.senhaHash = efcHash(me.login, nova); me.senhaTemp = ''; me.trocarSenha = 'N';
        store.upsert('Jogadores', me); return { ok: true };
      });
    }

    if (a === 'dados') {
      var out = {};
      for (var t in TABELAS) {
        if (t === 'Sessoes') continue;
        var rows = store.read(t);
        if (t === 'Jogadores') rows = rows.map(limpo);
        out[t] = rows;
      }
      return { dados: out, usuario: limpo(me) };
    }

    if (a === 'fotos') {
      var ids = req.ids || [], m = {};
      store.read('Jogadores').forEach(function (j) { if (ids.indexOf(s(j.id)) >= 0 && j.foto) m[j.id] = j.foto; });
      return { fotos: m };
    }

    if (a === 'salvarFoto') {
      var alvo = find('Jogadores', req.jogadorId); if (!alvo) erro('Jogador não encontrado.');
      if (s(alvo.id) !== s(me.id) && !admin(me)) erro('Sem permissão.');
      if (s(req.foto).length > 60000) erro('Foto muito grande.');
      return store.withLock(function () {
        alvo.foto = s(req.foto); alvo.fotoVer = String(Date.now()); store.upsert('Jogadores', alvo);
        return { fotoVer: alvo.fotoVer };
      });
    }

    if (a === 'resetarSenha') {
      if (!admin(me)) erro('Somente administradores.');
      var j = find('Jogadores', req.jogadorId); if (!j) erro('Jogador não encontrado.');
      var tmp = senhaTemp();
      return store.withLock(function () {
        if (!j.login) j.login = slug(j.apelido);
        j.senhaTemp = tmp; j.senhaHash = efcHash(j.login, tmp); j.trocarSenha = 'S';
        store.upsert('Jogadores', j); return { login: j.login, senhaTemp: tmp };
      });
    }

    if (a === 'enviarMidia') {
      var dono = find('Jogadores', req.jogadorId); if (!dono) erro('Jogador não encontrado.');
      var mime = s(req.mime), tipo = /^video\//.test(mime) ? 'video' : /^image\//.test(mime) ? 'foto' : '';
      if (!tipo) erro('Envie uma foto ou um vídeo.');
      if (s(req.dados).length > 28000000) erro('Arquivo muito grande (máximo 20 MB).');
      var ext = (mime.split('/')[1] || 'bin').replace('quicktime', 'mov').replace('jpeg', 'jpg');
      var arq = store.saveFile(s(dono.apelido) + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.' + ext, mime, s(req.dados));
      var row = { id: 'm_' + store.uuid().slice(0, 10), jogadorId: dono.id, autorId: me.id, tipo: tipo, mime: mime, arquivoId: arq,
        legenda: s(req.legenda).slice(0, 200), data: new Date().toISOString().slice(0, 10), jogoId: s(req.jogoId) };
      return store.withLock(function () { store.upsert('Midias', row); return { linha: row }; });
    }

    if (a === 'excluirMidia') {
      var md = find('Midias', req.id); if (!md) erro('Mídia não encontrada.');
      if (!admin(me) && s(md.autorId) !== s(me.id) && s(md.jogadorId) !== s(me.id)) erro('Sem permissão.');
      store.deleteFile(md.arquivoId);
      return store.withLock(function () { store.remove('Midias', md.id); return { ok: true }; });
    }

    if (a === 'salvar') {
      var tab = s(req.tabela); if (!TABELAS[tab]) erro('Tabela inválida.');
      var linhas = req.linhas || (req.linha ? [req.linha] : []);
      return store.withLock(function () {
        var salvos = [], extra = {};
        linhas.forEach(function (l) {
          var novo = {}; for (var k in l) if (PRIVADOS.indexOf(k) < 0) novo[k] = l[k];
          if (!novo.id) novo.id = (tab.charAt(0).toLowerCase()) + '_' + store.uuid().slice(0, 8);
          var antigo = find(tab, novo.id);
          var final = {}; var src = antigo || {};
          for (var k2 in src) final[k2] = src[k2];
          for (var k3 in novo) final[k3] = novo[k3];
          if (!podeSalvar(me, tab, final, antigo)) erro('Você não tem permissão para essa alteração.');
          if (tab === 'Jogadores' && !admin(me)) erro('Sem permissão.');
          if (tab === 'Jogadores' && !antigo) {
            final.login = final.login || slug(final.apelido);
            if (store.read('Jogadores').some(function (x) { return s(x.login) === final.login; })) final.login += String(Math.floor(Math.random() * 90 + 10));
            var tmp2 = senhaTemp(); final.senhaTemp = tmp2; final.senhaHash = efcHash(final.login, tmp2); final.trocarSenha = 'S';
            extra.login = final.login; extra.senhaTemp = tmp2;
          }
          store.upsert(tab, final); salvos.push(tab === 'Jogadores' ? limpo(final) : final);
        });
        return { linhas: salvos, extra: extra };
      });
    }

    if (a === 'excluir') {
      var tb = s(req.tabela); if (!TABELAS[tb]) erro('Tabela inválida.');
      return store.withLock(function () {
        (req.ids || [req.id]).forEach(function (id) {
          var ant = find(tb, id); if (!ant) return;
          if (!podeExcluir(me, tb, ant)) erro('Você não tem permissão para excluir.');
          store.remove(tb, id);
        });
        return { ok: true };
      });
    }

    erro('Ação desconhecida: ' + a);
  };

  function slug(t) {
    return s(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  }
}
