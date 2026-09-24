document.addEventListener('DOMContentLoaded', async function () {
  const api = createApi(APP_CONFIG);
  const lista = document.getElementById('lista-proyectos');
  const estado = document.getElementById('estado-proyectos');

  function mostrarEstado(contenido, clase) {
    estado.replaceChildren();
    if (!contenido) return;
    const box = el('div', { class: clase, role: clase.includes('danger') ? 'alert' : 'status' });
    contenido.forEach(c => box.append(c));
    estado.append(box);
  }

  async function cargar() {
    lista.replaceChildren();
    mostrarEstado([
      el('span', { class: 'spinner-border spinner-border-sm me-2', 'aria-hidden': 'true' }),
      'Cargando proyectos…'
    ], 'text-secondary');
    try {
      const proyectos = await api.listProjects();
      if (proyectos.length === 0) {
        mostrarEstado(['Aún no hay proyectos publicados.'], 'alert alert-secondary');
        return;
      }
      mostrarEstado(null);
      proyectos.forEach((p, i) => lista.append(renderProjectBlock(p, i)));
    } catch (e) {
      const retry = el('button', { type: 'button', class: 'btn btn-sm btn-outline-dark ms-3' }, ['Reintentar']);
      retry.addEventListener('click', cargar);
      mostrarEstado(['No pude cargar los proyectos. Revisa tu conexión e inténtalo de nuevo.', retry], 'alert alert-danger d-flex align-items-center');
    }
  }

  cargar();
});
