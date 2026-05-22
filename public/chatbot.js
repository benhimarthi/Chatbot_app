(function() {
  "use strict";

  console.log("ChatFlow SDK: Script loaded");

  // Use a single object for state, config, and methods to avoid scoping issues
  var ChatbotSDK = {
    config: {
      apiKey: null,
      baseUrl: null,
      primaryColor: "#4CAF50",
      position: "bottom-right",
      botName: "Chat Assistant",
      welcomeMessage: "Hi there! How can I help you today?",
    },
    state: {
      isOpen: false,
      messages: [],
      sessionId: null,
      isTyping: false,
      initialized: false
    },
    elements: {},

    init: function(userConfig) {
      if (this.state.initialized) {
        console.warn("Chatbot: Already initialized");
        return;
      }

      if (!userConfig || !userConfig.apiKey) {
        console.error("Chatbot: apiKey is required in config object");
        return;
      }

      console.log("Chatbot: Initializing with apiKey:", userConfig.apiKey);

      // Merge user config
      for (var key in userConfig) {
        if (userConfig.hasOwnProperty(key)) {
          this.config[key] = userConfig[key];
        }
      }
      
      // Determine base URL if not provided
      if (!this.config.baseUrl) {
        var scriptTag = document.currentScript || (function() {
          var scripts = document.getElementsByTagName('script');
          for (var i = scripts.length - 1; i >= 0; i--) {
            if (scripts[i].src && scripts[i].src.indexOf('chatbot.js') !== -1) return scripts[i];
          }
          return scripts[scripts.length - 1];
        })();
        
        if (scriptTag && scriptTag.src) {
          try {
            var scriptUrl = new URL(scriptTag.src);
            this.config.baseUrl = scriptUrl.origin;
          } catch(e) {
            console.error("Chatbot: Could not determine baseUrl from script tag", e);
          }
        }
      }

      if (!this.config.baseUrl) {
        console.warn("Chatbot: baseUrl not provided and could not be detected. Falling back to current origin.");
        this.config.baseUrl = window.location.origin;
      }

      console.log("Chatbot: Using baseUrl:", this.config.baseUrl);

      // Load session
      this.state.sessionId = localStorage.getItem("chatbot_session_id") || "sess_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("chatbot_session_id", this.state.sessionId);

      // Load history
      var savedHistory = localStorage.getItem("chatbot_history_" + this.config.apiKey);
      if (savedHistory) {
        try {
          this.state.messages = JSON.parse(savedHistory);
        } catch (e) {
          this.state.messages = [];
        }
      }

      if (this.state.messages.length === 0) {
        this.state.messages.push({
          role: 'bot',
          text: this.config.welcomeMessage,
          timestamp: new Date().toISOString()
        });
      }

      this._injectStyles();
      this._createUI();
      
      this.state.initialized = true;
      console.log("Chatbot: Successfully initialized and UI injected");
    },

    _injectStyles: function() {
      var css = `
        #chatbot-widget-container {
          position: fixed !important;
          bottom: 20px !important;
          ${this.config.position.includes('right') ? 'right: 20px !important;' : 'left: 20px !important;'}
          z-index: 2147483647 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          margin: 0 !important;
          padding: 0 !important;
          width: auto !important;
          height: auto !important;
        }
        #chatbot-bubble {
          width: 60px !important;
          height: 60px !important;
          border-radius: 50% !important;
          background-color: ${this.config.primaryColor} !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
          border: none !important;
          outline: none !important;
        }
        #chatbot-bubble:hover {
          transform: scale(1.1) !important;
        }
        #chatbot-bubble svg {
          fill: white !important;
          width: 30px !important;
          height: 30px !important;
          display: block !important;
          margin: 0 !important;
        }
        #chatbot-window {
          position: absolute !important;
          bottom: 80px !important;
          ${this.config.position.includes('right') ? 'right: 0 !important;' : 'left: 0 !important;'}
          width: 380px !important;
          height: 600px !important;
          max-height: calc(100vh - 120px) !important;
          background: white !important;
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12) !important;
          display: none !important;
          flex-direction: column !important;
          overflow: hidden !important;
          opacity: 0 !important;
          transform: translateY(20px) !important;
          transition: all 0.3s ease !important;
          border: 1px solid #e5e7eb !important;
        }
        #chatbot-window.open {
          display: flex !important;
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        #chatbot-header {
          background: ${this.config.primaryColor} !important;
          padding: 20px !important;
          color: white !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
        }
        #chatbot-header h3 {
          margin: 0 !important;
          font-size: 18px !important;
          font-weight: 600 !important;
          color: white !important;
        }
        #chatbot-messages {
          flex: 1 !important;
          overflow-y: auto !important;
          padding: 15px !important;
          background: #f9fafb !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
        }
        .chatbot-msg {
          max-width: 80% !important;
          padding: 10px 14px !important;
          border-radius: 18px !important;
          font-size: 14px !important;
          line-height: 1.4 !important;
          word-wrap: break-word !important;
          margin: 0 !important;
        }
        .chatbot-msg.bot {
          align-self: flex-start !important;
          background: white !important;
          color: #374151 !important;
          border: 1px solid #e5e7eb !important;
          border-bottom-left-radius: 4px !important;
        }
        .chatbot-msg.user {
          align-self: flex-end !important;
          background: ${this.config.primaryColor} !important;
          color: white !important;
          border-bottom-right-radius: 4px !important;
        }
        .chatbot-typing {
          align-self: flex-start !important;
          background: white !important;
          padding: 10px 14px !important;
          border-radius: 18px !important;
          display: flex !important;
          gap: 4px !important;
          border: 1px solid #e5e7eb !important;
        }
        .dot {
          width: 4px !important;
          height: 4px !important;
          background: #9ca3af !important;
          border-radius: 50% !important;
          animation: dot-pulse 1.4s infinite ease-in-out !important;
        }
        #chatbot-input-container {
          padding: 15px !important;
          background: white !important;
          border-top: 1px solid #e5e7eb !important;
          display: flex !important;
          gap: 10px !important;
        }
        #chatbot-input {
          flex: 1 !important;
          border: 1px solid #d1d5db !important;
          border-radius: 20px !important;
          padding: 10px 15px !important;
          font-size: 14px !important;
          outline: none !important;
          background: white !important;
          color: #111827 !important;
        }
        #chatbot-send {
          background: ${this.config.primaryColor} !important;
          color: white !important;
          border: none !important;
          width: 36px !important;
          height: 36px !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
        }
        #chatbot-send svg { width: 18px !important; height: 18px !important; fill: white !important; }
        
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        @media (max-width: 480px) {
          #chatbot-window {
            width: calc(100vw - 40px) !important;
            height: calc(100vh - 100px) !important;
          }
        }
      `;
      var styleTag = document.createElement("style");
      styleTag.id = "chatbot-styles";
      styleTag.textContent = css;
      document.head.appendChild(styleTag);
    },

    _createUI: function() {
      if (!document.body) {
        console.warn("Chatbot: Document body not ready, retrying UI creation...");
        setTimeout(this._createUI.bind(this), 100);
        return;
      }

      if (document.getElementById("chatbot-widget-container")) return;

      var container = document.createElement("div");
      container.id = "chatbot-widget-container";
      
      var bubble = document.createElement("div");
      bubble.id = "chatbot-bubble";
      bubble.title = "Chat with us";
      bubble.setAttribute('role', 'button');
      bubble.setAttribute('aria-label', 'Open chat');
      bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
      
      var windowEl = document.createElement("div");
      windowEl.id = "chatbot-window";
      windowEl.setAttribute('role', 'dialog');
      windowEl.setAttribute('aria-label', 'Chat window');
      windowEl.innerHTML = `
        <div id="chatbot-header">
          <div style="display:flex; align-items:center; gap:10px">
            <div style="width:10px; height:10px; background:#4ade80; border-radius:50%"></div>
            <h3>${this.config.botName}</h3>
          </div>
          <span style="cursor:pointer; font-size:20px; padding:5px; color:white;" id="chatbot-close" title="Close" role="button">✕</span>
        </div>
        <div id="chatbot-messages"></div>
        <div id="chatbot-input-container">
          <input type="text" id="chatbot-input" placeholder="Type a message..." autocomplete="off">
          <button id="chatbot-send" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div style="text-align:center; font-size:10px; color:#9ca3af; padding:8px; background: white;">Powered by Chat<span style="color:#4f46e5; font-weight:600;">Flow</span></div>
      `;

      container.appendChild(windowEl);
      container.appendChild(bubble);
      document.body.appendChild(container);

      console.log("Chatbot: UI elements attached to body");

      this.elements.container = container;
      this.elements.bubble = bubble;
      this.elements.window = windowEl;
      this.elements.messages = windowEl.querySelector("#chatbot-messages");
      this.elements.input = windowEl.querySelector("#chatbot-input");
      this.elements.send = windowEl.querySelector("#chatbot-send");
      this.elements.close = windowEl.querySelector("#chatbot-close");

      this._bindEvents();
      this._renderMessages();
    },

    _bindEvents: function() {
      var self = this;
      
      this.elements.bubble.onclick = function() {
        self.toggle();
      };

      this.elements.close.onclick = function() {
        self.toggle(false);
      };

      this.elements.send.onclick = function() {
        self.sendMessage();
      };

      this.elements.input.onkeypress = function(e) {
        if (e.key === "Enter") {
          self.sendMessage();
        }
      };
    },

    toggle: function(force) {
      this.state.isOpen = force !== undefined ? force : !this.state.isOpen;
      if (this.state.isOpen) {
        this.elements.window.style.display = 'flex';
        // Need a small timeout for the transition to work with display: flex
        var el = this.elements.window;
        setTimeout(function() { el.classList.add('open'); }, 10);
        this.elements.input.focus();
        this._scrollToBottom();
      } else {
        this.elements.window.classList.remove('open');
        var el = this.elements.window;
        var st = this.state;
        setTimeout(function() { 
          if(!st.isOpen) el.style.setProperty('display', 'none', 'important'); 
        }, 300);
      }
    },

    sendMessage: function() {
      var text = this.elements.input.value.trim();
      if (!text || this.state.isTyping) return;

      this.elements.input.value = "";
      this._addMessage('user', text);
      this._scrollToBottom();
      this._fetchAnswer(text);
    },

    _addMessage: function(role, text, images) {
      var msg = { role: role, text: text, images: images, timestamp: new Date().toISOString() };
      this.state.messages.push(msg);
      this._renderMessages();
      this._saveHistory();
    },

    _renderMessages: function() {
      var self = this;
      this.elements.messages.innerHTML = "";
      
      this.state.messages.forEach(function(msg) {
        var el = document.createElement("div");
        el.className = "chatbot-msg " + msg.role;
        
        var textEl = document.createElement("div");
        textEl.textContent = msg.text;
        el.appendChild(textEl);

        if (msg.images && msg.images.length > 0) {
          var imgContainer = document.createElement("div");
          imgContainer.style.marginTop = "10px";
          imgContainer.style.display = "flex";
          imgContainer.style.flexDirection = "column";
          imgContainer.style.gap = "5px";
          
          msg.images.forEach(function(img) {
            var imgEl = document.createElement("img");
            imgEl.src = img.url;
            imgEl.alt = img.alt;
            imgEl.style.width = "100%";
            imgEl.style.borderRadius = "8px";
            imgEl.referrerPolicy = "no-referrer";
            imgContainer.appendChild(imgEl);
          });
          el.appendChild(imgContainer);
        }
        
        self.elements.messages.appendChild(el);
      });

      if (this.state.isTyping) {
        var typing = document.createElement("div");
        typing.className = "chatbot-typing";
        typing.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
        this.elements.messages.appendChild(typing);
      }
      
      this._scrollToBottom();
    },

    _fetchAnswer: function(text) {
      var self = this;
      this.state.isTyping = true;
      this._renderMessages();

      fetch(this.config.baseUrl + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: this.config.apiKey,
          message: text,
          sessionId: this.state.sessionId
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        self.state.isTyping = false;
        if (data.error) {
          self._addMessage('bot', "Sorry, I'm having trouble connecting to the server.");
        } else {
          self._addMessage('bot', data.text, data.images);
        }
      })
      .catch(function(err) {
        self.state.isTyping = false;
        self._addMessage('bot', "Connection error. Please check your internet.");
        console.error("Chatbot Fetch Error:", err);
      });
    },

    _scrollToBottom: function() {
      this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    },

    _saveHistory: function() {
      var history = this.state.messages.slice(-50);
      localStorage.setItem("chatbot_history_" + this.config.apiKey, JSON.stringify(history));
    }
  };

  // Expose to window
  window.Chatbot = {
    init: function(config) {
      ChatbotSDK.init(config);
    },
    toggle: function(force) {
      ChatbotSDK.toggle(force);
    }
  };

})();
