/* Un link no puede obligar a abrirse en Google Chrome, pero esto hace lo mejor posible:
   - Android (navegador de WhatsApp, Instagram, Samsung, etc.): intenta abrir la pagina en Chrome sola (una vez)
     y deja un aviso con un boton por si no pasa.
   - iPhone: aviso con un boton que abre la pagina en Chrome.
   - Computador con otro navegador: solo un aviso. */
(function () {
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);
  var inApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|; wv\)/i.test(ua);
  var otherBrowser = /Edg\/|EdgA|EdgiOS|OPR\/|Opera|OPiOS|SamsungBrowser|Firefox|FxiOS|DuckDuckGo|Brave|Vivaldi|UCBrowser/i.test(ua);
  var isChrome = (/CriOS/.test(ua) || (/Chrome\//.test(ua) && !/Edg|OPR|SamsungBrowser/.test(ua))) && !inApp && !otherBrowser;
  if (isChrome) return;
  if (/[?&]nochrome=1/.test(location.search)) return;            /* para poder saltarse el aviso al probar */

  var url = location.href;
  var chromeUrl = "";
  if (isAndroid) {
    /* el intent no admite "#seccion" en la direccion: se manda sin ella (la pagina abre en su inicio) */
    chromeUrl = "intent://" + url.replace(/#.*$/, "").replace(/^https?:\/\//, "") +
      "#Intent;scheme=" + (location.protocol === "http:" ? "http" : "https") +
      ";package=com.android.chrome;S.browser_fallback_url=" + encodeURIComponent(url) + ";end";
    /* un solo intento automatico por visita, para no entrar en bucle */
    try {
      if (!sessionStorage.getItem("chrome-tried")) {
        sessionStorage.setItem("chrome-tried", "1");
        location.href = chromeUrl;
      }
    } catch (e) {}
  } else if (isIOS) {
    chromeUrl = (location.protocol === "http:" ? "googlechrome://" : "googlechromes://") + url.replace(/^https?:\/\//, "");
  }

  function banner() {
    if (document.getElementById("chrome-banner")) return;
    var b = document.createElement("div");
    b.id = "chrome-banner";
    b.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483000;display:flex;gap:10px;align-items:center;justify-content:center;" +
      "flex-wrap:wrap;padding:9px 14px;background:#fff3e4;color:#3a2440;font:600 14px/1.25 system-ui,sans-serif;text-align:center;" +
      "box-shadow:0 4px 18px rgba(0,0,0,.45)";
    var t = document.createElement("span");
    t.textContent = "Se ve y suena mejor en Google Chrome";
    b.appendChild(t);
    if (chromeUrl) {
      var a = document.createElement("a");
      a.href = chromeUrl; a.textContent = "Abrir en Chrome";
      a.style.cssText = "background:linear-gradient(135deg,#ffd58a,#ff9a5a 55%,#ff6f8e);color:#3a2440;text-decoration:none;" +
        "padding:6px 14px;border-radius:999px;font-weight:700";
      b.appendChild(a);
    }
    var x = document.createElement("button");
    x.type = "button"; x.setAttribute("aria-label", "Cerrar aviso"); x.textContent = "✕";
    x.style.cssText = "border:0;background:transparent;color:#3a2440;font-size:16px;cursor:pointer;padding:2px 6px";
    x.onclick = function () { b.remove(); };
    b.appendChild(x);
    document.body.appendChild(b);
  }
  if (document.body) banner(); else document.addEventListener("DOMContentLoaded", banner);
})();
