const _tests = [];
function test(name, fn) { _tests.push({ name, fn }); }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + e + ', recibido ' + a);
}
async function _run() {
  const ul = document.getElementById('out');
  let pass = 0;
  for (const t of _tests) {
    const li = document.createElement('li');
    try { await t.fn(); li.textContent = '✓ ' + t.name; li.className = 'ok'; pass++; }
    catch (e) { li.textContent = '✗ ' + t.name + ' — ' + e.message; li.className = 'fail'; }
    ul.appendChild(li);
  }
  document.getElementById('resumen').textContent = pass + '/' + _tests.length + ' pruebas pasan';
  document.title = pass === _tests.length ? 'TODAS OK' : 'HAY FALLOS';
}
window.addEventListener('load', _run);
