document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('save');
  const status = document.getElementById('status');

  const savedKey = await chrome.storage.sync.get('apiKey');
  apiKeyInput.value = savedKey.apiKey || '';

  function showStatus(message, color) {
      status.textContent = message;
      status.style.color = color;
      setTimeout(() => status.textContent = '', 2000);
  }

  saveButton.addEventListener('click', async () => {
      if (!apiKeyInput.value) {
          showStatus('API key cannot be empty!', 'red');
          return;
      }

      try {
          
          await chrome.storage.sync.set({ apiKey: apiKeyInput.value });
          showStatus('Settings saved!', 'green');
      } catch (error) {
          showStatus(error.message, 'red');
      }
  });
});
