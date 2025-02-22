const DEBOUNCE_TIME = 300;
let currentRequest = null;

console.log('Content script loaded!'); 

// Add these at the bottom of content.js
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
});
watchTextFields();
async function getStorage(key) {
  return new Promise(resolve => {
    chrome.storage.sync.get([key], result => resolve(result[key]));
  });
}
function watchTextFields() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          handleNewElements(node);
          if (node.shadowRoot) {
            handleNewElements(node.shadowRoot);
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable']
  });

  if (document.body) handleNewElements(document.body);
}

function handleNewElements(root) {
  const getElements = (container) => {
    try {
      return Array.from(container.querySelectorAll(
        'textarea, input[type="text"], [contenteditable="true"], [role="textbox"]'
      )).filter(el => el instanceof HTMLElement);
    } catch {
      return [];
    }
  };

  const elements = getElements(root);

  // Process shadow DOM
  elements.forEach(element => {
    if (element.shadowRoot) {
      handleNewElements(element.shadowRoot);
    }
  });

  elements.forEach(element => {
    if (element && element.dataset && !element.dataset.autotabHandled) {
      attachAIHandler(element);
      element.dataset.autotabHandled = "true";
    }
  });
}
function attachAIHandler(element) {
  const eventType = element.tagName === 'INPUT' ? 'input' : 'keyup';
  
  element.addEventListener(eventType, debounce(async (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    
    const {text, position} = getTextContext(element);
    if (text.length < 3) return;

    try {
      currentRequest?.abort();
      currentRequest = new AbortController();
      
      const suggestion = await chrome.runtime.sendMessage({
        type: 'fetchCompletion',
        text: text,
        apiKey: await getStorage('apiKey')
      });

        if (suggestion?.trim()) {  // Check for non-empty, non-whitespace suggestions
              showGhostText(element, suggestion, position);
            } else {
              clearGhostText(); // Explicitly clear any previous ghost text
                    }
    } catch (error) {
      console.log('API error:', error);
      clearGhostText(); 
    }
  }, DEBOUNCE_TIME));

  element.addEventListener('blur', clearGhostText);
  element.addEventListener('scroll', clearGhostText);
  element.addEventListener('keydown', handleKeyDown);
}

// Modified getTextContext()
function getTextContext(element) {
  let userText = '';
  let cursorPos = 0;

  if (element.isContentEditable) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    userText = range.startContainer.textContent.slice(0, range.startOffset);
    cursorPos = userText.length;
  } else {
    userText = element.value.slice(0, element.selectionStart);
    cursorPos = element.selectionStart;
  }

  // Get last 40 characters around cursor
  const context = userText.slice(Math.max(0, cursorPos - 20), cursorPos + 20);
  
  return {
    text: context, // Send only the actual text around cursor
    cursorPos: cursorPos,
    fullText: userText
  };
}

function showGhostText(element, suggestion, context) {
  // Clean up the suggestion
  let cleanSuggestion = suggestion
    .replace(context.fullText, '') // Remove duplicate text
    .replace(/^[\s.,]+/, '') // Remove leading punctuation
    .split(/[\s.,]/)[0]; // Take first word/phrase

  if (!cleanSuggestion) return;

  // Create ghost element
  const ghost = element.isContentEditable 
    ? createEditableGhost(cleanSuggestion) 
    : createInputGhost(element, cleanSuggestion);
  
  positionGhost(ghost, element, context.cursorPos);
}

function createEditableGhost(text) {
  const ghost = document.createElement('span');
  ghost.className = 'autotab-ghost';
  ghost.textContent = text;
  return ghost;
}

function createInputGhost(element, text) {
  const ghost = document.createElement('div');
  ghost.className = 'autotab-ghost-overlay';
  ghost.textContent = text;
  return ghost;
}


function clearGhostText() {
  document.querySelectorAll('.autotab-ghost, .autotab-ghost-overlay').forEach(el => el.remove());
}

function positionGhost(ghost, element, cursorPos) {
  if (element.isContentEditable) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(sel.anchorNode, sel.anchorOffset);
    range.collapse(true);
    range.insertNode(ghost);
  } else {
    const style = getComputedStyle(element);
    const fontSize = parseInt(style.fontSize) || 16;
    const paddingLeft = parseInt(style.paddingLeft) || 0;
    
    ghost.style.left = `${element.offsetLeft + cursorPos * fontSize * 0.6 + paddingLeft}px`;
    ghost.style.top = `${element.offsetTop}px`;
  }
}

function setCaretAfterGhost(ghost) {
  const range = document.createRange();
  range.setStartAfter(ghost);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function handleKeyDown(event) {
  const ghost = document.querySelector('.autotab-ghost, .autotab-ghost-overlay');
  if (event.key === 'Tab' && ghost) {
    event.preventDefault();
    event.stopPropagation();
    insertSuggestion(event.target, ghost.textContent);
    clearGhostText();
  }
}

function insertSuggestion(element, text) {
  if (element.isContentEditable) {
    const range = window.getSelection().getRangeAt(0);
    range.insertNode(document.createTextNode(text));
  } else {
    const start = element.selectionStart;
    element.value = element.value.slice(0, start) + text + element.value.slice(start);
    element.selectionStart = start + text.length;
    element.selectionEnd = start + text.length;
  }
  clearGhostText();
}

