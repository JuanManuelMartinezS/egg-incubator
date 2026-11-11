/* ---- tema ---- */
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('inc-theme', t); } catch {} requestDraw(); }
$('#btnTheme').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
try { const t = localStorage.getItem('inc-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
