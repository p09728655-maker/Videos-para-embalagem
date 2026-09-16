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

/* ── Esqueci minha senha ───────────────────────────────────────────────────
 * Pede ao Supabase o e-mail de redefinição. A resposta é 200 mesmo para
 * e-mail que não existe — de propósito: senão a tela viraria um jeito de
 * descobrir quem tem conta. Por isso a mensagem na tela é sempre a mesma.
 *
 * O link do e-mail volta para nova-senha.html com o token no fragmento da
 * URL. Esse endereço precisa estar na lista de Redirect URLs do projeto,
 * senão o Supabase manda para a Site URL e a página não recebe token nenhum.
 */
function supaRecuperarSenha(email) {
  var volta = window.location.origin + '/nova-senha.html';
  return fetch(window.SUPA.url + '/auth/v1/recover?redirect_to=' + encodeURIComponent(volta), {
    method: 'POST',
    headers: { 'apikey': window.SUPA.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  }).then(function (r) {
    if (r.ok) return true;
    return r.json()['catch'](function () { return {}; }).then(function (d) {
      if (r.status === 429) {
        throw new Error('Muitos pedidos seguidos. Espere alguns minutos e tente de novo.');
      }
      throw new Error(d.msg || d.error_description || d.message ||
                      ('não consegui enviar o e-mail (HTTP ' + r.status + ')'));
    });
  });
}

/* Grava a senha nova usando o token que veio no link do e-mail. O token vale
 * uma vez só e por pouco tempo — expirado, a pessoa pede outro. */
function supaTrocarSenha(token, senha) {
  return fetch(window.SUPA.url + '/auth/v1/user', {
    method: 'PUT',
    headers: {
      'apikey': window.SUPA.key,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: senha })
  }).then(function (r) {
    return r.json()['catch'](function () { return {}; }).then(function (d) {
      if (!r.ok) {
        throw new Error(d.msg || d.error_description || d.message ||
                        ('não consegui trocar a senha (HTTP ' + r.status + ')'));
      }
      return d;
    });
  });
}

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

/* Troca o painel exibido na TV. slug nulo ou vazio deixa a TV em espera, sem
   produto nenhum — e assim que se tira um painel do ar.
   Trocar de produto tambem limpa a pausa: senao o produto novo entraria
   congelado na primeira camada, com a pausa esquecida do produto anterior. */
function supaAtivarPainel(slug) {
  var valor = slug ? String(slug) : null;
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_config?id=eq.1', {
      method: 'PATCH',
      headers: cabecalhos(token, {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify({ painel_ativo: valor, tv_pausa: null })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error((valor ? 'não consegui trocar o painel da TV: '
                                : 'não consegui tirar o painel da TV: ') + r.status + ' ' + t);
        });
      }
      return r.json();
    });
  });
}

/* Pausa ou retoma a TV a distancia. Grava o carimbo em embalagem_config;
 * o player le esse campo de 5 em 5 segundos e obedece.
 * null = rodando. O carimbo tambem serve para mostrar ha quanto tempo esta
 * parada — TV pausada e esquecida e o risco real desta funcao. */
function supaPausarTV(pausar) {
  var valor = pausar ? new Date().toISOString() : null;
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_config?id=eq.1', {
      method: 'PATCH',
      headers: cabecalhos(token, {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify({ tv_pausa: valor })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error((pausar ? 'não consegui pausar a TV: '
                                  : 'não consegui retomar a TV: ') + r.status + ' ' + t);
        });
      }
      return r.json();
    });
  });
}

/* Manda o player recarregar a pagina. E o unico jeito de levar codigo novo do
 * player para a TV sem ir ate la com o controle: a troca de produto substitui o
 * conteudo no lugar, sem reload, para nao derrubar a tela cheia. */
function supaRecarregarTV() {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_config?id=eq.1', {
      method: 'PATCH',
      headers: cabecalhos(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tv_recarregar: new Date().toISOString() })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('não consegui mandar a TV atualizar: ' + r.status + ' ' + t);
        });
      }
      return true;
    });
  });
}

/* Troca o tempo por camada de um painel ja publicado. O trigger de UPDATE
 * carimba atualizado_em, e e esse carimbo que faz a TV recarregar sozinha. */
function supaDefinirTempo(slug, segundos) {
  var n = parseInt(segundos, 10);
  if (!(n > 0 && n <= 9999)) return Promise.reject(new Error('tempo inválido'));
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_paineis?slug=eq.' +
                 encodeURIComponent(slug), {
      method: 'PATCH',
      headers: cabecalhos(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ tempo: n })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('não consegui salvar o tempo: ' + r.status + ' ' + t);
        });
      }
      return n;
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
