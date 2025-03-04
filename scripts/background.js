// background.js
console.log('Service Worker Initialized');

// Keep service worker alive
const keepAlive = () => setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 20_000);

// Initialize keep-alive immediately and on startup
keepAlive();
chrome.runtime.onStartup.addListener(() => {
  console.log('Service Worker Started');
  keepAlive();
});

// Enhanced error handling
self.addEventListener('error', (e) => {
  console.error('SW Error:', e.error);
  return true;
});

// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.type === 'fetchCompletion') {
    if (!request.apiKey) {
      console.error('No API key provided');
      sendResponse(null);
      return true;
    }

    if (!request.text) {
      console.error('No text provided');
      sendResponse(null);
      return true;
    }

    console.log('Making API request with text:', request.text);
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${request.apiKey}`;
    
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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || !data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from Gemini API');
      }
      
      const completion = data.candidates[0].content.parts[0].text.trim();
      console.log('Sending completion:', completion);
      sendResponse(completion);
    })
    .catch(error => {
      console.error('Gemini Error:', error);
      sendResponse(null);
    });

    return true; // Keep message channel open
  } else {
    console.error('Unknown message type:', request.type);
    sendResponse(null);
    return true;
  }
});