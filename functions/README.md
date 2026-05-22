# ChatFlow WhatsApp Webhook - Firebase Cloud Functions

Deploy ChatFlow's incoming WhatsApp Webhook directly to **Firebase Cloud Functions**! 

This self-contained Cloud Function handles connection updates and incoming customer messages. If enabled, it automatically triggers a contextual AI assistant powered by Gemini (using your uploaded RAG business documents as knowledge context) and sends the response back via the WhatsApp Evolution API!

---

## 📂 File Structure

The `functions/` folder is pre-configured and completely self-contained:
*   `index.js`: The main Cloud Function handler.
*   `package.json`: Manages the required official dependencies.
*   `firebase-applet-config.json`: Automatically mirrors your specific database and project configuration parameter keys.
*   `.gitignore`: Excludes build artifacts and local variables.

---

## 🛠️ Step-by-Step Setup and Deployment

### 1. Install Firebase CLI (If not already installed)
Make sure you have Node.js installed, then install the global Firebase CLI:
```bash
npm install -g firebase-tools
```

### 2. Login and Select Project
Authenticate with your Google Account linked to your Firebase Console:
```bash
firebase login
```

Navigate to your workspace root directory and associate your Firebase project:
```bash
# Add or verify the active project matching glass-arcanum-480721-n7
firebase use glass-arcanum-480721-n7
```

### 3. Add Environment Secrets / Configuration
To allow your deployed Cloud Function to query Gemini and call the Evolution API, set the corresponding environment variables in your Firebase Functions environment config:

#### For Cloud Functions (v1 / Standard Request):
You can configure environment variables via the Firebase CLI using:
```bash
firebase functions:config:set \
  evolution.url="https://YOUR_EVOLUTION_API_URL" \
  evolution.key="YOUR_EVOLUTION_API_KEY" \
  gemini.key="YOUR_GEMINI_API_KEY"
```
*(Optionally, if you deploy newer v2 functions or use GCP Console, you can define standard OS environment variables: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, and `GEMINI_API_KEY` directly inside the Google Cloud Console for the Cloud Run / Cloud Functions service schema.)*

### 4. Deploy the Function
Navigate into or run the deploy command to publish:
```bash
firebase deploy --only functions
```

Once deployment completes, the Firebase CLI will output your live URL, which will look like:
`https://us-central1-glass-arcanum-480721-n7.cloudfunctions.net/evolutionWebhook`

---

## 📡 Register webhook on Evolution-API

Copy your deployed Cloud Function URL above and configure it as the primary Webhook Receiver inside your ChatFlow dashboard page (under Webhook Settings) or by sending a setup request to your Evolution API instance.

Now your WhatsApp chatbot is **100% automated** in the cloud! It will receive incoming messages, search your Firestore RAG documents, and reply instantly—even when your computer is shut down.
