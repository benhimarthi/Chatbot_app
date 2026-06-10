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

const getHeaders = (customApiKey?: string) => {
  const key = customApiKey || getApiKey();
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  };
};

/**
 * Gets the current connection state of a WhatsApp session from WaSender API.
 */
export const getConnectionState = async (instanceName: string, customSessionId?: string, customApiKey?: string) => {
  const key = customApiKey || getApiKey();
  
  if (!key || key === 'your_bearer_token') {
    console.warn("WaSender API Key not configured. Falling back to offline simulation.");
    return { connected: false, state: 'close', status: 'DISCONNECTED' };
  }

  try {
    const url = `https://www.wasenderapi.com/api/status`;
    console.log(`WaSender API: Checking connection status via GET /api/status...`);
    
    const response = await axios.get(url, { headers: getHeaders(key) });
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
export const connectSession = async (instanceName: string, customSessionId?: string, whatsappSession?: string | number) => {
  const sessionId = whatsappSession || customSessionId || getSessionId(instanceName);
  const token = getPersonalAccessToken();

  if (!token || token === 'your_personal_access_token' || token === 'your_bearer_token') {
    throw new Error('WaSender WASENDER_PERSONAL_ACCESS_TOKEN (or WASENDER_API_KEY) is not configured on the server. Please add it via Secrets setting.');
  }

  try {
    const url = `https://www.wasenderapi.com/api/whatsapp-sessions/${sessionId}/connect`;
    console.log(`WaSender API: Initiating connection for session ID "${sessionId}" (url: ${url})...`);
    const response = await axios.post(url, {}, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`WaSender connect API response:`, JSON.stringify(response.data));
    return response.data;
  } catch (error: any) {
    console.error('Error initiating WaSender connection:', error?.response?.data || error.message);
    // Ignore already open status or let client handle specific error cases
    return error?.response?.data || { success: false, message: error.message };
  }
};

/**
 * Fetches the QR code for a WhatsApp session from WaSender API.
 */
export const fetchQRCode = async (instanceName: string, customSessionId?: string, whatsappSession?: string | number) => {
  const sessionId = whatsappSession || customSessionId || getSessionId(instanceName);
  const token = getPersonalAccessToken();

  if (!token || token === 'your_personal_access_token' || token === 'your_bearer_token') {
    throw new Error('WaSender WASENDER_PERSONAL_ACCESS_TOKEN (or WASENDER_API_KEY) is not configured on the server. Please add it via Secrets setting.');
  }

  try {
    const url = `https://www.wasenderapi.com/api/whatsapp-sessions/${sessionId}/qrcode`;
    console.log(`WaSender API: Fetching QR Code for session ID "${sessionId}" (url: ${url})`);
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = response.data || {};
    console.log(`WaSender QR code API response:`, JSON.stringify(data));
    
    const qrCode = data.data?.qrCode || data.qrCode || '';
    
    if (!qrCode) {
      console.warn(`WaSender QR API did not return a clear qrCode string in data.data or keys.`);
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
export const sendTextMessage = async (instanceName: string, toPhone: string, text: string, customSessionId?: string, customApiKey?: string) => {
  const key = customApiKey || getApiKey();

  if (!key || key === 'your_bearer_token') {
    throw new Error('WASENDER_API_KEY is not configured.');
  }

  try {
    const url = `https://www.wasenderapi.com/api/send-message`;
    const payload = {
      to: toPhone,  // keep the + format e.g. "+212693450922"
      text: text
    };

    const response = await axios.post(url, payload, { headers: getHeaders(key) });
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
    'https://www.wasenderapi.com/api/whatsapp-sessions',
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
  
  return response.data; // contains session ID and API key under data
};
