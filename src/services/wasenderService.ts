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
  const pat = sanitizeEnvVal(process.env.WASENDER_PERSONAL_ACCESS_TOKEN);
  if (pat && pat !== 'your_personal_access_token') {
    return pat;
  }
  const apiKey = sanitizeEnvVal(process.env.WASENDER_API_KEY);
  if (apiKey && apiKey !== 'your_bearer_token') {
    return apiKey;
  }
  return 'your_personal_access_token';
};

const getBaseUrl = () => {
  return 'https://www.wasenderapi.com/api';
};

const getSessionId = (instanceName: string) => {
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
    const config = {
      method: 'GET',
      url: 'https://www.wasenderapi.com/api/status',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    };

    console.log(`WaSender API: Checking connection status on GET https://www.wasenderapi.com/api/status...`);
    const response = await axios(config);
    console.log(response.data);

    const data = response.data?.data || response.data || {};
    const rawState = String(data.status || data.state || '').toLowerCase();
    const connected = rawState === 'connected' || rawState === 'open' || rawState === 'active' || rawState === 'online';

    return {
      connected,
      state: connected ? 'open' : 'close',
      status: rawState.toUpperCase() || 'DISCONNECTED',
      phone: data.phone_number || ''
    };
  } catch (error: any) {
    console.error('Error:', error?.response?.data || error.message);
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
    const url = `${getBaseUrl()}/whatsapp-sessions/${sessionId}/connect`;
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
    const apiErrorData = error?.response?.data;
    const apiMsg = apiErrorData?.message || apiErrorData?.error || (apiErrorData ? JSON.stringify(apiErrorData) : error.message);
    console.error('Error initiating WaSender connection:', apiMsg);
    return apiErrorData || { success: false, message: error.message };
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
    const url = `${getBaseUrl()}/whatsapp-sessions/${sessionId}/qrcode`;
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
    const apiErrorData = error?.response?.data;
    const apiMsg = apiErrorData?.message || apiErrorData?.error || (apiErrorData ? JSON.stringify(apiErrorData) : error.message);
    const wrappedError = new Error(apiMsg || 'Failed to fetch QR code from WaSender API');
    (wrappedError as any).status = error?.response?.status;
    (wrappedError as any).response = error?.response;
    
    console.error('Error fetching WaSender QR code:', apiMsg);
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
    const url = `${getBaseUrl()}/send-message`;
    const payload = {
      to: toPhone,  // keep the + format e.g. "+212693450922"
      text: text
    };

    const response = await axios.post(url, payload, { headers: getHeaders(key) });
    return response.data;
  } catch (error: any) {
    const apiErrorData = error?.response?.data;
    const apiMsg = apiErrorData?.message || apiErrorData?.error || (apiErrorData ? JSON.stringify(apiErrorData) : error.message);
    throw new Error(`Failed to send WhatsApp message: ${apiMsg}`);
  }
};

/**
 * Stub matching Evolution API connection lifecycle interfaces.
 */
export const createInstance = async (instanceName: string) => {
  console.log(`&WaSender API: createInstance stub called for ${instanceName}.`);
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
  const key = getPersonalAccessToken();

  if (!key || key === 'your_personal_access_token' || key === 'your_bearer_token') {
    throw new Error('WASENDER_PERSONAL_ACCESS_TOKEN is not configured for session registration.');
  }
  
  // Clean phone number to be purely digits formatted with starting '+' (WaSender API expects valid E.164 string format)
  const digits = phoneNumber.replace(/\D/g, '');
  const cleanPhone = digits ? `+${digits}` : '';

  console.log(`[WaSender API Service] Registering/Creating WhatsApp session with WaSender API. Payload params: name="${clientName}", phone_number="${cleanPhone}", webhook_url="${webhookUrl}"`);

  try {
    const response = await axios.post(
      `${getBaseUrl()}/whatsapp-sessions`,
      {
        name: clientName,
        phone_number: cleanPhone,
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
    
    return response.data;
  } catch (error: any) {
    const apiErrorData = error?.response?.data;
    const apiMsg = apiErrorData?.message || apiErrorData?.error || (apiErrorData ? JSON.stringify(apiErrorData) : error.message);
    const wrappedError = new Error(apiMsg || 'Failed to create session with WaSender API');
    (wrappedError as any).status = error?.response?.status;
    (wrappedError as any).response = error?.response;
    
    console.error('Error creating WaSender session:', apiMsg);
    throw wrappedError;
  }
};
