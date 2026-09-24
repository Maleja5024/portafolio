(function (root) {
  function unwrap(data) {
    return data && !Array.isArray(data) && data.data !== undefined ? data.data : data;
  }

  function createApi(config, fetchFn) {
    const doFetch = fetchFn || function () { return fetch.apply(null, arguments); };

    async function call(url, key, body) {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workflow-Api-Key': key },
        body: JSON.stringify(body || {})
      });
      if (!res.ok) {
        const err = new Error('Error ' + res.status);
        err.status = res.status;
        throw err;
      }
      return unwrap(await res.json());
    }

    return {
      async listProjects() {
        const data = await call(config.LIST_URL, config.LIST_KEY, {});
        if (!Array.isArray(data)) throw new Error('Respuesta inesperada');
        return data.map(p => ({
          id: p.id,
          proyecto: p.proyecto,
          contexto: p.contexto,
          rol: p.rol,
          imagenes: root.Utils.splitLines(p.imagenes)
        }));
      },
      async verifyKey(key) {
        await call(config.ADMIN_URL, key, { accion: 'verificar' });
        return true;
      },
      async createProject(key, p) {
        const data = await call(config.ADMIN_URL, key, {
          accion: 'crear', proyecto: p.proyecto, contexto: p.contexto, rol: p.rol, imagenes: p.imagenes
        });
        return data.id;
      },
      async deleteProject(key, id) {
        await call(config.ADMIN_URL, key, { accion: 'eliminar', id: id });
        return true;
      }
    };
  }

  root.createApi = createApi;
})(window);
