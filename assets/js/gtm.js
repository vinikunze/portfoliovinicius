// Carrega o Google Tag Manager somente se houver um ID em config.js
(function () {
  var c = window.SITE_CONFIG || {};
  window.dataLayer = window.dataLayer || [];
  if (!c.gtmId || !/^GTM-[A-Z0-9]+$/i.test(c.gtmId)) return;
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(c.gtmId);
  document.head.appendChild(s);
})();
