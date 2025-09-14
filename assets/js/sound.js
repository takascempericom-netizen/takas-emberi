(() => {
  const URL_ = '/assets/sounds/notify.wav';
  const audio = new Audio(URL_);
  audio.preload = 'auto';

  let enabled = JSON.parse(localStorage.getItem('sound.enabled') ?? 'true');
  window.setSoundEnabled = (v) => {
    enabled = !!v;
    localStorage.setItem('sound.enabled', JSON.stringify(enabled));
  };
  window.isSoundEnabled = () => enabled;

  window.playNotify = async () => {
    if (!enabled) return;
    try {
      audio.currentTime = 0;
      await audio.play();
    } catch (e) {
      console.warn('[sound] play blocked (user gesture needed)', e);
    }
  };

  // İlk kullanıcı etkileşimi ile unlock
  const unlock = () => {
    audio.play().then(() => {
      audio.pause(); audio.currentTime = 0;
    }).catch(()=>{}).finally(()=>{
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    });
  };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  // Kendini doğrula
  window.__soundLoaded = true;
  console.log('[sound] loaded, enabled=', enabled);
})();
