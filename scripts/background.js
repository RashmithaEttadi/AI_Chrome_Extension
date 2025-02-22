// background.js
console.log('Service Worker Initializing...'); 

// Add activation handler
chrome.runtime.onStartup.addListener(() => {
  console.log('Service Worker Started');
});

// Add error handler
self.addEventListener('error', (e) => {
  console.error('SW Error:', e.error);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'fetchCompletion') {
      (async () => {
        const payload = {
            model: "qwen/qwen-turbo",
            messages: [{
              role: "system",
              content: "Continue the text exactly where it left off. Only provide the next few words to complete the sentence. No explanations."
            },{
              role: "user",
              content: `Complete this: "${message.text}"`
            }],
            max_tokens: 15,  // Very short suggestions
            temperature: 0.2, // More deterministic
            stop: ["\n", ".", ",", " "]
          };
        const url = "https://openrouter.ai/api/v1/chat/completions";
  
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${message.apiKey}`
            },
            body: JSON.stringify(payload)
          });
          console.log("called openRouter API");
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
  
          const data = await response.json();
          console.log("data returned from Model", data);
          if (data.choices && data.choices.length > 0) {
            const completion = data.choices[0].message.content?.trim();
            sendResponse(completion && completion.length > 0 ? completion : null);
          } else {
            console.error('No completion found in response:', data);
            sendResponse(null); 
          }
        } catch (error) {
          console.error("OpenRouter API error:", error);
          sendResponse(null);
        }
      })();
      return true;
    }
  });
  