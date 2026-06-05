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

const getBaseUrl = () => {
  const url = sanitizeEnvVal(process.env.EVOLUTION_API_URL);
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const getHeaders = () => {
  const key = sanitizeEnvVal(process.env.EVOLUTION_API_KEY);
  
  // Support both "ApiKey <key>" and other credential formats, defaulting to "ApiKey <key>" for best compatibility with Railway Evolution API configurations
  let authHeader = `ApiKey ${key}`;
  if (key.startsWith('Bearer ') || key.startsWith('ApiKey ')) {
    authHeader = key;
  } else if (key.startsWith('eyJ')) { // Standard JWT is Bearer
    authHeader = `Bearer ${key}`;
  }

  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'apiKey': key,
    'api-key': key,
    'x-api-key': key,
    'X-API-KEY': key,
    'Authorization': authHeader
  };
};

/**
 * Creates a new Evolution-API instance for a specific workspace.
 * @param instanceName Name/ID of the instance, strictly formatted as instance_{workspaceId}
 */
export const createInstance = async (instanceName: string) => {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error('EVOLUTION_API_URL is not configured on the server');
  }

  try {
    const response = await axios.post(
      `${baseUrl}/instance/create`,
      {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      },
      { headers: getHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error creating Evolution API instance:', error?.response?.data || error.message);
    throw new Error(error?.response?.data?.message || 'Failed to create WhatsApp instance');
  }
};

/**
 * Fetches the QR code (base64 or code) for a WhatsApp instance.
 */
export const fetchQRCode = async (instanceName: string) => {
  const baseUrl = getBaseUrl();
  try {
    const response = await axios.get(
      `${baseUrl}/instance/connect/${instanceName}`,
      { headers: getHeaders() }
    );
    return response.data;
  } catch (error: any) {
    const apiMsg = error?.response?.data?.message || error?.response?.data?.error || error.message;
    const wrappedError = new Error(apiMsg || 'Failed to fetch QR code');
    (wrappedError as any).status = error?.response?.status;
    (wrappedError as any).response = error?.response;
    
    // Log cleaner message to avoid polluting the server console
    if (error?.response?.status === 404) {
      console.log(`Notice: Instance ${instanceName} is not yet initialized or was not found on Evolution API.`);
    } else {
      console.error('Error fetching WhatsApp QR code:', error?.response?.data || error.message);
    }
    throw wrappedError;
  }
};

/**
 * Configures the webhook webhookUrl for MESSAGES_UPSERT and CONNECTION_UPDATE events.
 */
export const setWebhook = async (instanceName: string, webhookUrl: string) => {
  const baseUrl = getBaseUrl();
  const headers = getHeaders();

  const payload = {
    enabled: true,
    url: webhookUrl,
    webhookUrl: webhookUrl, // fallback
    byEvents: false,
    events: [
      'MESSAGES_UPSERT',
      'CONNECTION_UPDATE',
      'messages.upsert',
      'connection.update'
    ]
  };

  // Try standard set endpoint
  try {
    const response = await axios.post(
      `${baseUrl}/webhook/set/${instanceName}`,
      payload,
      { headers }
    );
    return response.data;
  } catch (error1: any) {
    // Quietly fallback to try the update endpoint
    try {
      const response = await axios.post(
        `${baseUrl}/webhook/update/${instanceName}`,
        payload,
        { headers }
      );
      return response.data;
    } catch (error2: any) {
      // Quietly return info without printing errors/warnings to the logs
      return { success: false, message: 'Skipped auto-configuration, using manual configurations instead.' };
    }
  }
};

/**
 * Gets the current connection state of a WhatsApp instance.
 */
export const getConnectionState = async (instanceName: string) => {
  const baseUrl = getBaseUrl();
  try {
    const response = await axios.get(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      { headers: getHeaders() }
    );
    return response.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const bodyStr = error?.response?.data ? JSON.stringify(error.response.data).toLowerCase() : "";
    const isNotFound = status === 404 || 
                       bodyStr.includes('not found') || 
                       bodyStr.includes('wasnotfound') || 
                       bodyStr.includes('was not found');

    if (isNotFound) {
      console.log(`Notice: Instance ${instanceName} is not yet initialized or was not found on Evolution API (assuming disconnected state).`);
    } else {
      console.error('Error getting WhatsApp connection state:', error?.response?.data || error.message);
    }
    // Suppress if instance doesn't exist yet
    return { instance: { state: 'close' } };
  }
};

/**
 * Sends a text message to a specific recipient phone number.
 */
export const sendTextMessage = async (instanceName: string, toPhone: string, text: string) => {
  const baseUrl = getBaseUrl();
  const formattedPhone = toPhone.replace(/\D/g, '');

  const payload1 = {
    number: formattedPhone,
    options: {
      delay: 1000,
      presence: 'composing',
      linkPreview: false
    },
    textMessage: {
      text: text
    }
  };

  const payload2 = {
    number: formattedPhone,
    textMessage: {
      text: text
    }
  };

  const payload3 = {
    number: formattedPhone,
    text: text
  };

  // Modern Evolution API payloads list to execute sequentially if one fails
  const payloads = [payload1, payload2, payload3];
  let lastError: any = null;

  for (const payload of payloads) {
    try {
      console.log(`Attempting message dispatch to instance ${instanceName} using payload format:`, JSON.stringify(payload));
      const response = await axios.post(
        `${baseUrl}/message/sendText/${instanceName}`,
        payload,
        { headers: getHeaders() }
      );
      console.log(`Successfully sent message with format:`, JSON.stringify(payload));
      return response.data;
    } catch (err: any) {
      console.warn(`Payload variation failed: Status ${err?.response?.status}, Body: ${JSON.stringify(err?.response?.data || err.message)}`);
      lastError = err;
    }
  }

  // If all failed, throw the last error with rich debug details
  console.error(`All message payload formats failed for instance ${instanceName}:`, lastError?.response?.data || lastError.message);
  
  const errBody = lastError?.response?.data;
  let errMsg = "Failed to send WhatsApp message via provider";
  if (errBody) {
    errMsg += `: [${lastError.response.status}] ${typeof errBody === 'object' ? JSON.stringify(errBody) : String(errBody)}`;
  } else {
    errMsg += `: ${lastError.message}`;
  }
  
  throw new Error(errMsg);
};
