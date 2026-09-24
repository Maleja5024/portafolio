(function (root) {
  const U = root.Utils;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
    (children || []).forEach(c => node.append(c));
    return node;
  }

  function renderProjectBlock(p, index) {
    const block = el('div', {
      class: 'project-block' + (index % 2 === 1 ? ' alt' : ''),
      'data-project': String(p.id)
    });

    block.append(el('div', { class: 'project-label' }, [
      el('span', { class: 'project-num' }, [String(index + 1).padStart(2, '0')]),
      el('h3', { class: 'project-name' }, [U.ordinal(index + 1), el('br'), 'proyecto']),
      el('p', { class: 'project-subtitle' }, [p.proyecto])
    ]));

    const meta = el('div', { class: 'project-meta' }, [
      el('div', { class: 'project-col' }, [el('h4', {}, ['Contexto']), el('p', {}, [p.contexto])]),
      el('div', { class: 'project-col' }, [
        el('h4', {}, ['Mi rol']),
        el('ul', {}, U.splitLines(p.rol).map(line => el('li', {}, [line])))
      ])
    ]);

    const content = el('div', { class: 'project-content' }, [meta]);

    if (p.imagenes.length > 0) {
      const screens = el('div', { class: 'project-screens ' + U.screensClass(p.imagenes.length) });
      p.imagenes.forEach((src, i) => {
        const img = el('img', { src: src, alt: U.imageAlt(p.proyecto, i), class: 'project-img', loading: 'lazy' });
        img.addEventListener('load', () => {
          if (img.naturalWidth > img.naturalHeight) img.classList.add('project-img-landscape');
        });
        img.addEventListener('error', () => img.remove());
        screens.append(img);
      });
      content.append(screens);
    }

    block.append(content);
    return block;
  }

  root.el = el;
  root.renderProjectBlock = renderProjectBlock;
})(window);
