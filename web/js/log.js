/* =====================================================================
   Registro (consola)
   ===================================================================== */
function log(kind, text) {
  const box = $('#log'), row = document.createElement('div');
  row.className = kind;
  row.textContent = (kind === 'tx' ? '→ ' : kind === 'rx' ? '← ' : '') + text;
  box.appendChild(row);
  while (box.childElementCount > 400) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
  if (kind !== 'rx' || !text.startsWith('T,')) $('#consoleLast').textContent = text.slice(0, 80);
}
