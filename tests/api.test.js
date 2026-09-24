const CFG = { LIST_URL: 'https://r/list', LIST_KEY: 'kL', ADMIN_URL: 'https://r/admin' };
function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, opts }); return { ok: status >= 200 && status < 300, status, json: async () => body }; };
  fn.calls = calls;
  return fn;
}

test('listProjects manda POST con la clave pública y normaliza imagenes', async () => {
  const f = fakeFetch(200, [{ id: 1, proyecto: 'A', contexto: 'B', rol: 'x\ny', imagenes: 'u1\n\nu2' }]);
  const list = await createApi(CFG, f).listProjects();
  eq(f.calls[0].url, 'https://r/list');
  eq(f.calls[0].opts.method, 'POST');
  eq(f.calls[0].opts.headers['X-Workflow-Api-Key'], 'kL');
  eq(list, [{ id: 1, proyecto: 'A', contexto: 'B', rol: 'x\ny', imagenes: ['u1', 'u2'] }]);
});
test('listProjects desenvuelve {data: [...]}', async () => {
  const list = await createApi(CFG, fakeFetch(200, { data: [{ id: 2, proyecto: 'P', contexto: 'C', rol: 'R', imagenes: 'u' }] })).listProjects();
  eq(list.length, 1);
});
test('listProjects lanza si no llega un arreglo', async () => {
  let msg = '';
  try { await createApi(CFG, fakeFetch(200, { algo: 1 })).listProjects(); } catch (e) { msg = e.message; }
  eq(msg, 'Respuesta inesperada');
});
test('createProject envía accion crear con la clave de admin y devuelve el id', async () => {
  const f = fakeFetch(200, { ok: true, id: 7 });
  const id = await createApi(CFG, f).createProject('kA', { proyecto: 'A', contexto: 'B', rol: 'C', imagenes: 'u' });
  eq(id, 7);
  eq(f.calls[0].url, 'https://r/admin');
  eq(f.calls[0].opts.headers['X-Workflow-Api-Key'], 'kA');
  eq(JSON.parse(f.calls[0].opts.body), { accion: 'crear', proyecto: 'A', contexto: 'B', rol: 'C', imagenes: 'u' });
});
test('deleteProject envía accion eliminar con id numérico', async () => {
  const f = fakeFetch(200, { ok: true });
  await createApi(CFG, f).deleteProject('kA', 5);
  eq(JSON.parse(f.calls[0].opts.body), { accion: 'eliminar', id: 5 });
});
test('clave incorrecta: el error trae status 401', async () => {
  let status = 0;
  try { await createApi(CFG, fakeFetch(401, {})).verifyKey('mala'); } catch (e) { status = e.status; }
  eq(status, 401);
});
test('verifyKey devuelve true con clave buena', async () => {
  eq(await createApi(CFG, fakeFetch(200, { ok: true })).verifyKey('buena'), true);
});
