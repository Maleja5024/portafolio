document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('formulario-contacto');
  const estado = document.getElementById('estado-contacto');
  const btn = document.getElementById('btn-enviar');
  let enviando = false;

  function aviso(tipo, texto) {
    const div = document.createElement('div');
    div.className = 'alert alert-' + tipo + ' mb-0';
    div.setAttribute('role', tipo === 'danger' ? 'alert' : 'status');
    div.textContent = texto;
    estado.replaceChildren(div);
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (enviando) return;
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    enviando = true;
    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.textContent = 'Enviando…';
    try {
      const res = await fetch(APP_CONFIG.FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (!res.ok) throw new Error('Error ' + res.status);
      form.reset();
      form.classList.remove('was-validated');
      aviso('success', '¡Gracias! Recibí tu mensaje y te responderé pronto.');
    } catch (e) {
      aviso('danger', 'No pude enviar el mensaje. Inténtalo de nuevo o escríbeme a ayalamaleja77@gmail.com.');
    } finally {
      enviando = false;
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  });
});
