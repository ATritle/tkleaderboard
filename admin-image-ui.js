/* Player image dropdown for the TK Leaderboard admin page. */
(async function () {
  const select = document.getElementById('playerImage');
  const preview = document.getElementById('playerImagePreview');
  const empty = document.getElementById('playerImageEmpty');

  if (!select) return;

  let images = [];

  try {
    const response = await fetch(
      `data/player-images.json?v=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    images = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Could not load player-images.json:', error);
    return;
  }

  images
    .map(x => String(x).trim())
    .filter(Boolean)
    .forEach(filename => {
      const option = document.createElement('option');
      option.value = filename;
      option.textContent = filename;
      select.appendChild(option);
    });

  function updatePreview() {
    const filename = select.value;

    if (!filename) {
      preview.removeAttribute('src');
      preview.classList.remove('visible');
      empty.style.display = 'flex';
      return;
    }

    preview.src = `assets/${encodeURIComponent(filename)}`;
    preview.classList.add('visible');
    empty.style.display = 'none';
  }

  select.addEventListener('change', updatePreview);

  window.updatePlayerImageDropdown = function (filename) {
    select.value = filename || '';
    updatePreview();
  };

  updatePreview();
})();