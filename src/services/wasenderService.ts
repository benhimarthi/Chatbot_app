import axios from 'axios';

const sanitizeEnvVal = (val: string | undefined): string => {
  if (!val) return '';
  let sanitized = val.trim();
  if (sanitized.startsWith('"') && sanitized.endsWith('"')) {
    sanitized = sanitized.slice(1, -1);
  } else if (sanitized.startsWith("'") && sanitized.endsWith("'")) {
    sanitized = sanitized.slice(1, -1);
  }
  return sanitized.trim();
};

const getApiKey = () => {
  return sanitizeEnvVal(process.env.WASENDER_API_KEY) || 'your_bearer_token';
};

const getPersonalAccessToken = () => {
  return sanitizeEnvVal(process.env.WASENDER_PERSONAL_ACCESS_TOKEN) || sanitizeEnvVal(process.env.WASENDER_API_KEY) || 'your_personal_access_token';
};

const getSessionId = (instanceName: string) => {
  // Fallback to SESSION_ID env if instanceName is empty or doesn't map to a specific sessions
  const envSessionId = sanitizeEnvVal(process.env.SESSION_ID);
  if (envSessionId && envSessionId !== 'your_session_id') {
    return envSessionId;
  }
  return instanceName.replace(/^instance_/, '');
};

const getHeaders = () => {
  const key = getApiKey();
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  };
};

/**
 * Gets the current connection state of a WhatsApp session from WaSender API.
 */
export const getConnectionState = async (instanceName: string, customSessionId?: string) => {
  const key = getApiKey();
  
  if (!key || key === 'your_bearer_token') {
    console.warn("WaSender API Key not configured. Falling back to offline simulation.");
    return { connected: false, state: 'close', status: 'DISCONNECTED' };
  }

  try {
    const url = `https://wasenderapi.com/api/status`;
    console.log(`WaSender API: Checking connection status...`);
    
    const response = await axios.get(url, { headers: getHeaders() });
    const data = response.data || {};
    
    const rawState = String(data.status || '').toLowerCase();
    const connected = rawState === 'connected' || rawState === 'open' || rawState === 'active';
    
    console.log(`WaSender API status: connected=${connected}, raw_state=${rawState}`);
    
    return {
      connected,
      state: connected ? 'open' : 'close',
      status: rawState.toUpperCase(),
      phone: ''
    };
  } catch (error: any) {
    console.error('Error getting WaSender status:', error?.response?.data || error.message);
    return { connected: false, state: 'close', status: 'DISCONNECTED' };
  }
};

/**
 * Fetches the QR code for a WhatsApp session from WaSender API.
 */
export const fetchQRCode = async (instanceName: string, customSessionId?: string) => {
  const sessionId = customSessionId || getSessionId(instanceName);
  const key = getApiKey();

  if (!key || key === 'your_bearer_token') {
    throw new Error('WaSender WASENDER_API_KEY is not configured on the server. Please add it via Secrets setting.');
  }

  try {
    const url = `https://api.wasenderapi.com/api/sessions/${sessionId}/qr`;
    console.log(`WaSender API: Fetching QR Code for session: ${sessionId} (url: ${url})`);
    
    const response = await axios.get(url, { headers: getHeaders() });
    const data = response.data || {};
    
    // Grab any likely QR base64, image, code string from potential response schemas
    const qrCode = data.qrCode || data.qr || data.code || data.base64 || data.data || '';
    
    if (!qrCode) {
      console.warn(`WaSender QR API did not return a clear code. Full response structure:`, JSON.stringify(data));
    }
    
    return {
      qrcode: {
        base64: qrCode
      },
      ...data
    };
  } catch (error: any) {
    const apiMsg = error?.response?.data?.message || error?.response?.data?.error || error.message;
    const wrappedError = new Error(apiMsg || 'Failed to fetch QR code from WaSender API');
    (wrappedError as any).status = error?.response?.status;
    (wrappedError as any).response = error?.response;
    
    console.error('Error fetching WaSender QR code:', error?.response?.data || error.message);
    throw wrappedError;
  }
};

/**
 * Sends a text message via WaSender API.
 */
export const sendTextMessage = async (instanceName: string, toPhone: string, text: string, customSessionId?: string) => {
  const key = getApiKey();

  if (!key || key === 'your_bearer_token') {
    throw new Error('WASENDER_API_KEY is not configured.');
  }

  try {
    const url = `https://wasenderapi.com/api/send-message`;
    const payload = {
      to: toPhone,  // keep the + format e.g. "+212693450922"
      text: text
    };

    const response = await axios.post(url, payload, { headers: getHeaders() });
    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to send: ${JSON.stringify(error?.response?.data || error.message)}`);
  }
};

/**
 * Stub matching Evolution API connection lifecycle interfaces.
 */
export const createInstance = async (instanceName: string) => {
  console.log(`WaSender API: createInstance stub called for ${instanceName}.`);
  return { success: true, message: "WaSender session initialized" };
};

/**
 * Stub matching Evolution API webhook subscription interfaces.
 */
export const setWebhook = async (instanceName: string, webhookUrl: string) => {
  console.log(`WaSender API: setWebhook stub called for ${instanceName} to ${webhookUrl}`);
  return { success: true, message: "WaSender webhook stored locally" };
};

/**
 * Creates a new WhatsApp session with WaSender API for new clients.
 */
export const createSession = async (clientName: string, phoneNumber: string, webhookUrl: string) => {
  const key = getPersonalAccessToken(); // different from session API key!
  
  const response = await axios.post(
    'https://wasenderapi.com/api/whatsapp-sessions',
    {
      name: clientName,
      phone_number: phoneNumber,
      account_protection: true,
      log_messages: true,
      read_incoming_messages: false,
      webhook_url: webhookUrl,
      webhook_enabled: true,
      webhook_events: [
        "messages.received",
        "session.status",
        "messages.update"
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data; // contains session ID and API key
};
