/* Conexão com o Supabase (projeto crono-analise, mesmo do RitmoProd).
 *
 * Esta chave é PUBLICÁVEL: ela sozinha só permite o que as políticas de acesso
 * (RLS) liberam para visitante — neste caso, apenas LEITURA dos painéis de
 * embalagem. Publicar ou trocar o painel da TV exige login, e o login usa os
 * mesmos usuários do RitmoProd. Nenhuma chave de administrador entra aqui.
 */
window.SUPA = {
  url: 'https://meqjsdrgwnupvreghxgm.supabase.co',
  key: 'sb_publishable_PxLuVvLDpq1OQVqTBt3OAg_s1jz1jpF',
  bucket: 'embalagem'
};

/* ── Data da versão publicada ───────────────────────────────────────────────
   O painel não tem numero de versao: o que identifica a versao publicada e a
   data em que ela foi publicada (embalagem_paineis.atualizado_em). As tres
   telas mostram essa data, entao as duas funcoes moram aqui. ES5 puro: o
   navegador da Smart TV tambem carrega este arquivo. */

/* Declaracao fora do bloco: funcao dentro de try tem semantica diferente em
   navegador antigo, e a TV roda um Chromium de 2019. */
function doisDigitos(n) { return n < 10 ? '0' + n : String(n); }

/* 14/09/2026 07:00 */
window.dataBR = function (iso) {
  if (!iso) return '—';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1) + '/' +
           d.getFullYear() + ' ' +
           doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
  } catch (e) { return String(iso); }
};

/* 14/09/2026 */
window.dataCurtaBR = function (iso) {
  var t = window.dataBR(iso);
  return t.split(' ')[0];
};

/* "hoje", "ontem", "há 3 dias" — conta virada de dia, nao horas corridas:
   publicado as 18h de ontem e "ontem" mesmo com 15 horas de diferenca. */
window.haQuantoTempo = function (iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var ini = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var hoje = new Date();
    hoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    var dias = Math.round((hoje.getTime() - ini.getTime()) / 86400000);
    if (dias < 0) return '';
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 30) return 'há ' + dias + ' dias';
    var meses = Math.floor(dias / 30);
    if (meses < 12) return 'há ' + meses + (meses === 1 ? ' mês' : ' meses');
    var anos = Math.floor(dias / 365);
    return 'há ' + anos + (anos === 1 ? ' ano' : ' anos');
  } catch (e) { return ''; }
};

/* URL pública de uma imagem do bucket. */
window.supaImagem = function (caminho) {
  return window.SUPA.url + '/storage/v1/object/public/' +
         window.SUPA.bucket + '/' + caminho;
};

/* GET na API REST. Sem SDK de propósito: o navegador da Smart TV é antigo e
   o SDK moderno não roda nele. fetch + headers funciona em todos. */
window.supaGet = function (caminho) {
  return fetch(window.SUPA.url + '/rest/v1/' + caminho, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'apikey': window.SUPA.key,
      'Accept': 'application/json'
    }
  }).then(function (r) {
    if (!r.ok) throw new Error('Supabase ' + r.status + ' em ' + caminho);
    return r.json();
  });
};
