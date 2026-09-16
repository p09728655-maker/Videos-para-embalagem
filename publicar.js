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

/* ── Quem está usando ──────────────────────────────────────────────────────
 * O papel vem da tabela usuarios, a mesma do RitmoProd: admin e analista
 * publicam e excluem painel; coletor (o tablet do chão de fábrica) só opera a
 * TV. A tela esconde o que a pessoa não pode fazer — o banco recusa de
 * qualquer jeito, mas botão que não funciona é armadilha.
 */
function idDoToken(token) {
  try {
    var corpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (corpo.length % 4) corpo += '=';
    return JSON.parse(decodeURIComponent(escape(atob(corpo)))).sub || null;
  } catch (e) { return null; }
}

var usuarioCache = null;
function supaUsuarioAtual(forcar) {
  if (usuarioCache && !forcar) return Promise.resolve(usuarioCache);
  /* Aparelho não tem sessão nem linha em usuarios: a identidade dele vem do
     token, conferida no banco a cada abertura. */
  if (ehAparelho()) {
    return supaEstadoAparelho().then(function (a) {
      usuarioCache = { id: null, papel: 'aparelho', nome: a ? a.nome : null,
                       email: null, ativo: !!(a && a.ativo), empresa_id: null };
      return usuarioCache;
    });
  }
  return tokenValido().then(function (token) {
    var id = idDoToken(token);
    if (!id) throw new Error('sessão sem identificação');
    return fetch(window.SUPA.url + '/rest/v1/usuarios?id=eq.' + id +
                 '&select=id,nome,email,papel,ativo,empresa_id', {
      headers: cabecalhos(token, {})
    }).then(function (r) {
      if (!r.ok) throw new Error('não consegui ler o perfil: ' + r.status);
      return r.json();
    }).then(function (rows) {
      /* Conta sem linha em usuarios não tem papel nenhum: entra, mas não faz
         nada. É o caso de quem foi criado direto no painel do Supabase. */
      usuarioCache = (rows && rows[0]) || { id: id, papel: null, nome: null,
                                            email: null, ativo: false, empresa_id: null };
      return usuarioCache;
    });
  });
}
function limparUsuarioCache() { usuarioCache = null; }

/* Carimba o acesso. Sem isto a lista de aparelhos não sabe dizer se um tablet
 * ainda está em uso ou foi esquecido numa gaveta. Uma vez por abertura da
 * página, e falha em silêncio: é informação de apoio, não pode travar a tela. */
function supaMarcarAcesso() {
  if (ehAparelho()) return Promise.resolve(true);   /* o estado do aparelho já carimba */
  return tokenValido().then(function (token) {
    var id = idDoToken(token);
    if (!id) return false;
    return fetch(window.SUPA.url + '/rest/v1/usuarios?id=eq.' + id, {
      method: 'PATCH',
      headers: cabecalhos(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ultimo_acesso_em: new Date().toISOString() })
    }).then(function () { return true; });
  })['catch'](function () { return false; });
}

/* Espelham embalagem_pode_operar() e embalagem_pode_publicar() no banco.
   Gerar painel é só no computador; o resto vale nos dois. */
function podeOperar(u) {
  return !!u && u.ativo && (['admin','analista'].indexOf(u.papel) >= 0 || u.papel === 'aparelho');
}
function podePublicar(u) { return !!u && u.ativo && ['admin','analista'].indexOf(u.papel) >= 0; }
function ehDispositivo(u) { return !!u && u.papel === 'aparelho'; }

/* ── Tablet autorizado, sem conta de e-mail ────────────────────────────────
 * Aparelho não é pessoa: não tem caixa de e-mail e não deveria precisar de
 * uma. A tentativa anterior criava o tablet como usuário do Supabase Auth e
 * esbarrava na confirmação por e-mail — cada aparelho novo gastava um envio
 * para uma caixa inexistente, até estourar o limite.
 *
 * Agora o computador gera um código, o tablet digita, e o banco devolve um
 * token que fica guardado só naquele aparelho. Revogar é desligar o aparelho
 * na lista; o token para de valer na mesma hora.
 */
var APARELHO_KEY = 'ritmopatrimar_aparelho';

function aparelhoSalvo() {
  try { return JSON.parse(localStorage.getItem(APARELHO_KEY) || 'null'); }
  catch (e) { return null; }
}
function salvarAparelho(a) {
  try { localStorage.setItem(APARELHO_KEY, JSON.stringify(a)); } catch (e) {}
}
function esquecerAparelho() {
  try { localStorage.removeItem(APARELHO_KEY); } catch (e) {}
}
function ehAparelho() { var a = aparelhoSalvo(); return !!(a && a.token); }
function tokenAparelho() { var a = aparelhoSalvo(); return a ? a.token : null; }
/* Quem pode agir: pessoa com sessão ou aparelho autorizado. */
function temAcesso() { return estaLogado() || ehAparelho(); }

/* Código de autorização: oito caracteres, em dois blocos, sem os que se
 * confundem à mão (I, O, 0, 1). */
function codigoSorteado() {
  var letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', saida = '', i;
  try {
    var buf = new Uint32Array(8);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (i = 0; i < 8; i++) saida += letras[buf[i] % letras.length];
  } catch (e) {
    for (i = 0; i < 8; i++) saida += letras[Math.floor(Math.random() * letras.length)];
  }
  return saida;
}
function formatarCodigo(c) {
  c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4, 8) : c;
}

/* Chamada de função no banco usando o token do aparelho, sem sessão. */
function rpcAparelho(funcao, args, oQue) {
  var corpo = { p_token: tokenAparelho() };
  for (var k in args) if (args.hasOwnProperty(k)) corpo[k] = args[k];
  return fetch(window.SUPA.url + '/rest/v1/rpc/' + funcao, {
    method: 'POST',
    headers: { 'apikey': window.SUPA.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  }).then(function (r) {
    if (r.ok) return r.status === 204 ? true : r.json()['catch'](function () { return true; });
    return r.text().then(function (t) {
      if (t.indexOf('nao autorizado') >= 0 || t.indexOf('revogado') >= 0) {
        throw new Error('este tablet foi revogado. Peça um código novo no computador.');
      }
      throw new Error('não consegui ' + oQue + ': ' + r.status + ' ' + t);
    });
  });
}

/* Cria o aparelho e o código que o autoriza. Nenhuma conta de e-mail entra
 * nisso: a linha nasce sem token, e o token só existe quando o tablet parear. */
function supaCriarDispositivo(nome) {
  var codigo = codigoSorteado();
  return supaUsuarioAtual().then(function (eu) {
    if (!podePublicar(eu)) {
      throw new Error('só quem publica painel autoriza um aparelho novo.');
    }
    return tokenValido().then(function (token) {
      return fetch(window.SUPA.url + '/rest/v1/embalagem_dispositivos', {
        method: 'POST',
        headers: cabecalhos(token, {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }),
        body: JSON.stringify({ nome: nome || 'Tablet', ativo: true, criado_por: eu.id })
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            throw new Error('não consegui criar o aparelho: ' + r.status + ' ' + t);
          });
        }
        return r.json();
      }).then(function (rows) {
        var disp = rows && rows[0];
        if (!disp) throw new Error('o banco não devolveu o aparelho criado');
        return fetch(window.SUPA.url + '/rest/v1/embalagem_pareamentos', {
          method: 'POST',
          headers: cabecalhos(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            codigo: codigo, dispositivo_id: disp.id, criado_por: eu.id,
            expira_em: new Date(Date.now() + 15 * 60000).toISOString()
          })
        }).then(function (r2) {
          if (!r2.ok) {
            return r2.text().then(function (t) {
              throw new Error('aparelho criado, mas não consegui gerar o código: ' +
                              r2.status + ' ' + t);
            });
          }
          return { id: disp.id, nome: disp.nome, codigo: codigo,
                   expiraEm: Date.now() + 15 * 60000 };
        });
      });
    });
  });
}

/* O tablet digita o código e recebe o token. Chamada aberta a visitante de
 * propósito: o tablet ainda não tem nada quando digita. */
function supaEntrarComCodigo(codigo) {
  var limpo = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpo.length !== 8) {
    return Promise.reject(new Error('o código tem 8 caracteres, como ABCD-EFGH.'));
  }
  return fetch(window.SUPA.url + '/rest/v1/rpc/embalagem_parear', {
    method: 'POST',
    headers: { 'apikey': window.SUPA.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_codigo: limpo })
  }).then(function (r) {
    return r.json()['catch'](function () { return null; }).then(function (d) {
      if (!r.ok || !d || !d.length || !d[0].token) {
        throw new Error('código inválido ou vencido. Gere outro no computador.');
      }
      salvarAparelho({ token: d[0].token, nome: d[0].nome });
      return d[0];
    });
  });
}

/* Confere se este aparelho continua valendo, e diz o nome dele. */
function supaEstadoAparelho() {
  if (!ehAparelho()) return Promise.resolve(null);
  return fetch(window.SUPA.url + '/rest/v1/rpc/embalagem_aparelho_estado', {
    method: 'POST',
    headers: { 'apikey': window.SUPA.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: tokenAparelho() })
  }).then(function (r) {
    if (!r.ok) return { papel: 'aparelho', nome: (aparelhoSalvo() || {}).nome, ativo: false };
    return r.json().then(function (d) {
      var a = d && d[0];
      if (a && a.nome) salvarAparelho({ token: tokenAparelho(), nome: a.nome });
      return { papel: 'aparelho', nome: a ? a.nome : null, ativo: !!(a && a.ativo) };
    });
  })['catch'](function () {
    /* Sem rede não dá para confirmar: mantém o que o aparelho já sabia. */
    return { papel: 'aparelho', nome: (aparelhoSalvo() || {}).nome, ativo: true };
  });
}

/* A lista de aparelhos, para saber quem está autorizado e poder revogar. */
function supaListarDispositivos() {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_dispositivos' +
                 '?select=id,nome,ativo,ultimo_acesso_em,pareado_em&order=nome.asc', {
      headers: cabecalhos(token, {})
    }).then(function (r) {
      if (!r.ok) throw new Error('não consegui listar os aparelhos: ' + r.status);
      return r.json();
    });
  });
}

function supaSituacaoDispositivo(id, ativo) {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/embalagem_dispositivos?id=eq.' +
                 encodeURIComponent(id), {
      method: 'PATCH',
      headers: cabecalhos(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ativo: !!ativo })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('não consegui mudar o aparelho: ' + r.status + ' ' + t);
        });
      }
      return true;
    });
  });
}

function montarLinkCodigo(codigo) {
  return window.location.origin + '/biblioteca.html#codigo=' + encodeURIComponent(codigo);
}

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
  if (ehAparelho()) {
    return rpcAparelho('embalagem_op_ativar', { p_slug: valor },
                       valor ? 'trocar o painel da TV' : 'tirar o painel da TV');
  }
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
  if (ehAparelho()) {
    return rpcAparelho('embalagem_op_pausa', { p_pausar: !!pausar },
                       pausar ? 'pausar a TV' : 'retomar a TV');
  }
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
  if (ehAparelho()) {
    return rpcAparelho('embalagem_op_recarregar', {}, 'mandar a TV atualizar');
  }
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

/* Chamada de funcao no banco (RPC). */
function supaRpc(funcao, args, oQue) {
  return tokenValido().then(function (token) {
    return fetch(window.SUPA.url + '/rest/v1/rpc/' + funcao, {
      method: 'POST',
      headers: cabecalhos(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(args)
    }).then(function (r) {
      if (r.ok) return true;
      return r.text().then(function (t) {
        if (r.status === 403 || t.indexOf('sem permissao') >= 0) {
          throw new Error('este aparelho não tem permissão para ' + oQue + '.');
        }
        throw new Error('não consegui ' + oQue + ': ' + r.status + ' ' + t);
      });
    });
  });
}

/* Tempo e exibicao passam por funcao no banco, nao por UPDATE na tabela: assim
 * o tablet do chao de fabrica ajusta o ritmo sem ganhar permissao de alterar o
 * painel inteiro nem de excluir nada. */
function supaDefinirTempo(slug, segundos) {
  var n = parseInt(segundos, 10);
  if (!(n > 0 && n <= 9999)) return Promise.reject(new Error('tempo inválido'));
  if (ehAparelho()) {
    return rpcAparelho('embalagem_op_tempo', { p_slug: slug, p_segundos: n },
                       'salvar o tempo').then(function () { return n; });
  }
  return supaRpc('embalagem_definir_tempo', { p_slug: slug, p_segundos: n },
                 'salvar o tempo').then(function () { return n; });
}

function supaDefinirOpcoes(slug, opcoes) {
  var o = opcoes || {}, comp = o.componentes !== false, so = o.soDesenho === true;
  if (ehAparelho()) {
    return rpcAparelho('embalagem_op_exibicao',
                       { p_slug: slug, p_componentes: comp, p_so_desenho: so },
                       'salvar a exibição');
  }
  return supaRpc('embalagem_definir_exibicao',
                 { p_slug: slug, p_componentes: comp, p_so_desenho: so },
                 'salvar a exibição');
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
