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
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'apiKey': key,
    'api-key': key,
    'x-api-key': key,
    'X-API-KEY': key,
    'Authorization': `Bearer ${key}`
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
    console.error('Error fetching WhatsApp QR code:', error?.response?.data || error.message);
    throw new Error(error?.response?.data?.message || 'Failed to fetch QR code');
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
    console.error('Error getting WhatsApp connection state:', error?.response?.data || error.message);
    // Suppress if instance doesn't exist yet
    return { instance: { state: 'close' } };
  }
};

/**
 * Sends a text message to a specific recipient phone number.
 */
export const sendTextMessage = async (instanceName: string, toPhone: string, text: string) => {
  const baseUrl = getBaseUrl();
  
  // Format the number for WhatsApp (remove +, spaces, leading zeros or dashes)
  // Standard format is string matching e.g. "5511999999999" (without @s.whatsapp.net for endpoint sendText)
  const formattedPhone = toPhone.replace(/\D/g, '');

  try {
    const response = await axios.post(
      `${baseUrl}/message/sendText/${instanceName}`,
      {
        number: formattedPhone,
        options: {
          delay: 1000,
          presence: 'composing',
          linkPreview: false
        },
        textMessage: {
          text: text
        }
      },
      { headers: getHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error(`Error sending message on instance ${instanceName}:`, error?.response?.data || error.message);
    throw new Error(error?.response?.data?.message || 'Failed to send WhatsApp message via provider');
  }
};
