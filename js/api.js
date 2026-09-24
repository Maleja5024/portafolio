(function (root) {
  function unwrap(data) {
    return data && !Array.isArray(data) && data.data !== undefined ? data.data : data;
  }

  function createApi(config, fetchFn) {
    const doFetch = fetchFn || function () { return fetch.apply(null, arguments); };

    async function call(url, key, body) {
      // Petición "simple" (text/plain, sin cabeceras propias): el navegador no hace preflight
      // CORS, que Retool rechaza con 401 porque OPTIONS no lleva la clave.
      const res = await doFetch(url + '?workflowApiKey=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
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
        const fila = Array.isArray(data) ? data[0] : data;
        return fila && fila.id;
      },
      async deleteProject(key, id) {
        await call(config.ADMIN_URL, key, { accion: 'eliminar', id: id });
        return true;
      }
    };
  }

  root.createApi = createApi;
})(window);
