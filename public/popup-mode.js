(() => {
  const params = new URLSearchParams(window.location.search);
  const isPopup = params.get('view') === 'popup' || params.get('mode') === 'popup';

  if (isPopup) {
    document.documentElement.classList.add('is-popup');
  }
})();
