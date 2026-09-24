document.addEventListener('DOMContentLoaded', function () {
  const api = createApi(APP_CONFIG);
  const $ = (id) => document.getElementById(id);
  const KEY_STORE = 'adminKey';
  const modal = new bootstrap.Modal($('modal-eliminar'));
  const CAMPOS = ['proyecto', 'contexto', 'rol', 'imagenes'];
  let adminKey = null;
  let idPorEliminar = null;

  function leerClave() { try { return sessionStorage.getItem(KEY_STORE); } catch (e) { return null; } }
  function guardarClave(k) { try { sessionStorage.setItem(KEY_STORE, k); } catch (e) { /* sin storage: la clave vive solo en memoria */ } }
  function borrarClave() { try { sessionStorage.removeItem(KEY_STORE); } catch (e) { /* nada */ } }

  function aviso(contenedor, tipo, texto) {
    contenedor.replaceChildren(el('div', { class: 'alert alert-' + tipo + ' mb-0', role: tipo === 'danger' ? 'alert' : 'status' }, [texto]));
  }
  function ocupado(btn, on, textoOn) {
    btn.disabled = on;
    if (on) { btn.dataset.txt = btn.innerHTML; btn.textContent = textoOn; } else if (btn.dataset.txt) { btn.innerHTML = btn.dataset.txt; }
  }

  function mostrarPanel(logueado) {
    $('panel-login').hidden = logueado;
    $('panel-admin').hidden = !logueado;
    if (logueado) cargarLista();
  }

  async function entrar(clave) {
    try {
      await api.verifyKey(clave);
      adminKey = clave;
      guardarClave(clave);
      $('estado-login').replaceChildren();
      mostrarPanel(true);
      return true;
    } catch (e) {
      const msg = (e.status === 401 || e.status === 403) ? 'Clave incorrecta.' : 'No pude conectar con el servidor. Inténtalo de nuevo.';
      aviso($('estado-login'), 'danger', msg);
      return false;
    }
  }

  $('form-login').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const clave = $('input-clave').value.trim();
    if (!clave) { aviso($('estado-login'), 'danger', 'Escribe la clave.'); return; }
    const btn = $('btn-entrar');
    ocupado(btn, true, 'Entrando…');
    const ok = await entrar(clave);
    ocupado(btn, false);
    if (ok) $('input-clave').value = '';
  });

  $('btn-salir').addEventListener('click', function () {
    adminKey = null;
    borrarClave();
    mostrarPanel(false);
  });

  async function cargarLista() {
    const ul = $('lista-admin');
    ul.replaceChildren(el('li', { class: 'list-group-item text-secondary' }, ['Cargando…']));
    try {
      const proyectos = await api.listProjects();
      if (proyectos.length === 0) {
        ul.replaceChildren(el('li', { class: 'list-group-item text-secondary' }, ['Aún no hay proyectos.']));
        return;
      }
      ul.replaceChildren(...proyectos.map(function (p) {
        const btn = el('button', { type: 'button', class: 'btn btn-outline-danger btn-sm', 'aria-label': 'Eliminar ' + p.proyecto }, []);
        btn.innerHTML = '<i class="bi bi-trash"></i>';
        btn.addEventListener('click', function () {
          idPorEliminar = p.id;
          $('modal-nombre').textContent = p.proyecto;
          modal.show();
        });
        return el('li', { class: 'list-group-item d-flex justify-content-between align-items-center gap-3' }, [
          el('span', {}, [p.proyecto]), btn
        ]);
      }));
    } catch (e) {
      ul.replaceChildren(el('li', { class: 'list-group-item text-danger' }, ['No pude cargar la lista.']));
    }
  }

  $('btn-confirmar-eliminar').addEventListener('click', async function () {
    const btn = $('btn-confirmar-eliminar');
    ocupado(btn, true, 'Eliminando…');
    try {
      await api.deleteProject(adminKey, idPorEliminar);
      modal.hide();
      aviso($('estado-admin'), 'success', 'Proyecto eliminado.');
      await cargarLista();
    } catch (e) {
      modal.hide();
      manejarErrorAdmin(e, 'No pude eliminar el proyecto.');
    } finally {
      ocupado(btn, false);
      idPorEliminar = null;
    }
  });

  function manejarErrorAdmin(e, texto) {
    if (e.status === 401 || e.status === 403) {
      adminKey = null;
      borrarClave();
      mostrarPanel(false);
      aviso($('estado-login'), 'danger', 'La clave dejó de ser válida. Vuelve a entrar.');
    } else {
      aviso($('estado-admin'), 'danger', texto);
    }
  }

  function limpiarErrores() {
    CAMPOS.forEach(function (c) { $('f-' + c).classList.remove('is-invalid'); $('err-' + c).textContent = ''; });
  }

  $('form-proyecto').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    limpiarErrores();
    const datos = {};
    CAMPOS.forEach(function (c) { datos[c] = $('f-' + c).value; });
    const errores = Utils.validateProject(datos);
    const campos = Object.keys(errores);
    if (campos.length > 0) {
      campos.forEach(function (c) { $('f-' + c).classList.add('is-invalid'); $('err-' + c).textContent = errores[c]; });
      $('f-' + campos[0]).focus();
      return;
    }
    const btn = $('btn-guardar');
    ocupado(btn, true, 'Guardando…');
    try {
      await api.createProject(adminKey, {
        proyecto: datos.proyecto.trim(),
        contexto: datos.contexto.trim(),
        rol: Utils.splitLines(datos.rol).join('\n'),
        imagenes: Utils.splitLines(datos.imagenes).join('\n')
      });
      $('form-proyecto').reset();
      aviso($('estado-admin'), 'success', 'Proyecto guardado.');
      await cargarLista();
    } catch (e) {
      manejarErrorAdmin(e, 'No pude guardar el proyecto. Inténtalo de nuevo.');
    } finally {
      ocupado(btn, false);
    }
  });

  const guardada = leerClave();
  if (guardada) { entrar(guardada).then(function (ok) { if (!ok) borrarClave(); }); }
});
