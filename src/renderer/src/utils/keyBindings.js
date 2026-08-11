const SPECIAL = {
  Space: { token: 'Space', label: 'Space' },
  Enter: { token: 'Enter', label: 'Enter' },
  Tab: { token: 'Tab', label: 'Tab' },
  Escape: { token: 'Escape', label: 'Esc' },
  Backspace: { token: 'Backspace', label: 'Backspace' },
  Delete: { token: 'Delete', label: 'Del' },
  Insert: { token: 'Insert', label: 'Ins' },
  Home: { token: 'Home', label: 'Home' },
  End: { token: 'End', label: 'End' },
  PageUp: { token: 'PageUp', label: 'PgUp' },
  PageDown: { token: 'PageDown', label: 'PgDn' },
  ArrowUp: { token: 'Up', label: 'Up' },
  ArrowDown: { token: 'Down', label: 'Down' },
  ArrowLeft: { token: 'Left', label: 'Left' },
  ArrowRight: { token: 'Right', label: 'Right' }
};

export function buildBinding(event) {
  const parts = [];
  const labelParts = [];
  if (event.ctrlKey) {
    parts.push('Control');
    labelParts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
    labelParts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
    labelParts.push('Shift');
  }
  if (event.metaKey) {
    parts.push('Super');
    labelParts.push('Win');
  }

  const finish = (token, label) => ({
    accelerator: [...parts, token].join('+'),
    label: [...labelParts, label].join('+')
  });

  const code = event.code || '';

  if (code === 'ControlLeft' || code === 'ControlRight' || code === 'ShiftLeft' || code === 'ShiftRight' || code === 'AltLeft' || code === 'AltRight' || code === 'MetaLeft' || code === 'MetaRight') return null;

  if (/^F\d{1,2}$/.test(code)) return finish(code, code);

  const key = event.key;
  if (key && key.length === 1) {
    let token = key;
    if (/^[a-zA-Z]$/.test(token)) token = token.toUpperCase();
    if (token === ' ') token = 'Space';
    return finish(token, token);
  }

  if (code === 'Space') return finish('Space', 'Space');

  const special = SPECIAL[code];
  if (special) return finish(special.token, special.label);

  const numMatch = code.match(/^Numpad(\d)$/);
  if (numMatch) return finish('num' + numMatch[1], 'Num ' + numMatch[1]);

  return null;
}