// background.js
console.log('Service Worker Initialized');

// Keep service worker alive
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20_000);
chrome.runtime.onStartup.addListener(() => {
  keepAlive();
  console.log('Service Worker Started');
});

// Enhanced error handling
self.addEventListener('error', (e) => {
  console.error('SW Error:', e.error);
  return true;
});

// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'generate') {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${request.apiKey}`;
    
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Continue this text naturally: "${request.text}". Respond ONLY with the text continuation, no explanations.`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 25,
          temperature: 0.3,
          topP: 0.95
        }
      })
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      
      const completion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      sendResponse(completion || null);
      console.log("received response ");
    })
    .catch(error => {
      console.error('Gemini Error:', error);
      sendResponse(null);
    });

    return true; // Keep message channel open
  }
});