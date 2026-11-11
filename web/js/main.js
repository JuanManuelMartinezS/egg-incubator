/* ---- arranque ---- */
setConnUI(); Object.keys(FIELDS).forEach(setField); $('#spRange').value = S.cfg.SP; refreshForm(); drawAll(); renderCompare();
document.fonts?.ready.then(requestDraw);
window.__S = S;   // depuración desde la consola del navegador
