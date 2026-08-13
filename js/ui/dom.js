/* Tiny DOM helpers shared by every screen. No framework, no build step. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** el('button', {class:'btn', onclick: fn}, ['押す']) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'value' && isField) node.value = value;
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const frag = (...children) => {
  const f = document.createDocumentFragment();
  for (const c of children.flat()) if (c) f.append(c.nodeType ? c : document.createTextNode(String(c)));
  return f;
};

export function clear(node) { while (node.firstChild) node.firstChild.remove(); return node; }

/* ---------------------------------------------------------------- toast */

let toastTimer = null;
export function toast(message, ms = 2200) {
  const box = $('#toast');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, ms);
}

/* ---------------------------------------------------------------- sheet */

/** Open the bottom sheet with a title and a rendered body. */
export function openSheet(title, body) {
  const dialog = $('#sheet');
  $('#sheetTitle').textContent = title;
  clear($('#sheetBody')).append(body);
  if (!dialog.open) dialog.showModal();
  return dialog;
}

export function closeSheet() {
  const dialog = $('#sheet');
  if (dialog?.open) dialog.close();
}

/* --------------------------------------------------------------- pieces */

export const field = (label, control) =>
  el('label', { class: 'field' }, [el('span', { class: 'field__label', text: label }), control]);

export const button = (text, onclick, cls = 'btn') => el('button', { class: cls, onclick }, [text]);

/** A confirm dialog that resolves to true/false. */
export function confirmSheet(title, message, { danger = false, okText = 'OK' } = {}) {
  return new Promise(resolve => {
    const done = value => { closeSheet(); resolve(value); };
    openSheet(title, frag(
      el('p', { class: 'muted', text: message }),
      el('div', { class: 'row', style: { marginTop: '14px' } }, [
        el('button', { class: 'btn grow', onclick: () => done(false) }, ['やめる']),
        el('button', { class: `btn grow ${danger ? 'btn--danger' : 'btn--primary'}`, onclick: () => done(true) }, [okText]),
      ]),
    ));
  });
}

/** Hit-point bar shared by the party list and the session tool. */
export function hpBar(hp, maxHp) {
  const ratio = maxHp > 0 ? Math.max(0, hp) / maxHp : 0;
  const state = ratio > .6 ? 'is-ok' : ratio > .3 ? 'is-mid' : '';
  return el('div', { class: 'pc__bar' }, [
    el('div', { class: `pc__fill ${state}`, style: { width: `${Math.round(ratio * 100)}%` } }),
  ]);
}

export const signed = n => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);
