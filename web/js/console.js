/* ---- consola ---- */
const cons = $('#console');
const toggleCons = () => { const o = cons.classList.toggle('open'); $('#consoleBar').setAttribute('aria-expanded', o); };
$('#consoleBar').addEventListener('click', toggleCons);
$('#consoleBar').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCons(); } });
$('#cmdForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#cmd').value.trim(); if (!v) return; if (!S.conn) { toast('Sin conexión.'); return; } send(v); $('#cmd').value = ''; });
$('#logT').addEventListener('change', e => S.logT = e.target.checked);
$('#logClear').addEventListener('click', () => $('#log').innerHTML = '');
