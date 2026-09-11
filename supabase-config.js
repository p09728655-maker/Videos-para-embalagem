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
