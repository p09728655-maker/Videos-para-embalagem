/* Escrita no Supabase: login e publicação de painéis.
 *
 * Só o gerador e a biblioteca carregam este arquivo — o player da TV nunca
 * escreve, e por isso não precisa dele.
 *
 * A sessão fica no localStorage deste navegador. O access_token dura cerca de
 * uma hora; quando vence, é renovado pelo refresh_token sem pedir a senha de
 * novo. Nenhuma senha é guardada em lugar nenhum.
 */

var SESSAO_KEY = 'ritmopatrimar_sessao';

function sessaoSalva() {
  try { return JSON.parse(localStorage.getItem(SESSAO_KEY) || 'null'); }
  catch (e) { return null; }
}
function salvarSessao(s) {
  try {
    localStorage.setItem(SESSAO_KEY, JSON.stringify({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expira_em: Date.now() + ((s.expires_in || 3600) * 1000) - 60000,
      email: s.user && s.user.email
    }));
  } catch (e) {}
}
function limparSessao() {
  try { localStorage.removeItem(SESSAO_KEY); } catch (e) {}
}

function estaLogado() {
  var s = sessaoSalva();
  return !!(s && s.refresh_token);
}
function emailLogado() {
  var s = sessaoSalva();
  return s ? s.email : null;
}

function supaLogin(email, senha) {
  return fetch(window.SUPA.url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': window.SUPA.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: senha })
  }).then(function (r) {
    return r.json().then(function (d) {
      if (!r.ok) {
        throw new Error(d.error_description || d.msg || d.message ||
                        ('login recusado (HTTP ' + r.status + ')'));
      }
      salvarSessao(d);
      return d;
    });
  });
}

function supaLogout() { limparSessao(); }

/* Devolve um access_token válido, renovando se estiver perto de vencer. */
function tokenValido() {
  var s = sessaoSalva();
  if (!s || !s.refresh_token) return Promise.reject(new Error('não autenticado'));
  if (s.access_token && s.expira_em && Date.now() < s.expira_em) {
    return Promise.resolve(s.access_token);
  }
  return fetch(window.SUPA.url + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { 'apikey': window.SUPA.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refresh_token })
  }).then(function (r) {
    if (!r.ok) { limparSessao(); throw new Error('sessão expirada, entre de novo'); }
    return r.json();
  }).then(function (d) { salvarSessao(d); return d.access_token; });
}

function cabecalhos(token, extra) {
  var h = {
    'apikey': window.SUPA.key,
    'Authorization': 'Bearer ' + token
  };
  for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
  return h;
}

/* Envia uma imagem para o bucket, sobrescrevendo se já existir
   (republicar o mesmo produto tem que substituir, não duplicar). */
function supaUpload(caminho, blob, tipo) {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/storage/v1/object/' +
                 window.SUPA.bucket + '/' + caminho, {
      method: 'POST',
      headers: cabecalhos(token, { 'Content-Type': tipo, 'x-upsert': 'true' }),
      body: blob
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('upload de ' + caminho + ' falhou: ' + r.status + ' ' + t);
        });
      }
      return caminho;
    });
  });
}

/* Grava o painel. merge-duplicates faz virar atualização quando o slug já existe. */
function supaSalvarPainel(registro) {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_paineis', {
      method: 'POST',
      headers: cabecalhos(token, {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      }),
      body: JSON.stringify(registro)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('não consegui salvar o painel: ' + r.status + ' ' + t);
        });
      }
      return r.json();
    });
  });
}

/* Troca o painel exibido na TV. */
function supaAtivarPainel(slug) {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_config?id=eq.1', {
      method: 'PATCH',
      headers: cabecalhos(token, {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify({ painel_ativo: slug })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('não consegui trocar o painel da TV: ' + r.status + ' ' + t);
        });
      }
      return r.json();
    });
  });
}

/* Alterna a exibicao da coluna de componentes sem regerar o painel. */
function supaDefinirOpcoes(slug, opcoes) {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_paineis?slug=eq.' +
                 encodeURIComponent(slug), {
      method: 'PATCH',
      headers: cabecalhos(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ opcoes: opcoes })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('não consegui salvar a opção: ' + r.status + ' ' + t);
        });
      }
      return true;
    });
  });
}

function supaExcluirPainel(slug) {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_paineis?slug=eq.' +
                 encodeURIComponent(slug), {
      method: 'DELETE',
      headers: cabecalhos(token, {})
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('não consegui excluir: ' + r.status + ' ' + t);
        });
      }
      return true;
    });
  });
}

/* data:image/jpeg;base64,... -> Blob, para subir como arquivo em vez de texto */
function dataUrlParaBlob(dataUrl) {
  var partes = dataUrl.split(',');
  var tipo = (partes[0].match(/:(.*?);/) || [null, 'image/jpeg'])[1];
  var bin = atob(partes[1]);
  var n = bin.length;
  var buf = new Uint8Array(n);
  while (n--) buf[n] = bin.charCodeAt(n);
  return { blob: new Blob([buf], { type: tipo }), tipo: tipo };
}
