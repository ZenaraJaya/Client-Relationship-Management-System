const {setGlobalOptions} = require("firebase-functions/v2/options");
const {onDocumentDeleted} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const {defineSecret, defineString} = require("firebase-functions/params");

setGlobalOptions({maxInstances: 10});

const laravelWebhookUrl = defineString("LARAVEL_FIRESTORE_DELETE_WEBHOOK_URL");
const firestoreSyncSecret = defineSecret("FIRESTORE_SYNC_SECRET");

async function notifyLaravelDelete(collection, documentId) {
  const url = laravelWebhookUrl.value();
  if (!url) {
    throw new Error("LARAVEL_FIRESTORE_DELETE_WEBHOOK_URL is not configured.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Firestore-Sync-Secret": firestoreSyncSecret.value(),
    },
    body: JSON.stringify({
      collection,
      document_id: documentId,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Laravel sync failed (${response.status}) for ${collection}/${documentId}: ${body}`,
    );
  }
}

exports.onCrmDocumentDeleted = onDocumentDeleted(
  {
    document: "crms/{docId}",
    secrets: [firestoreSyncSecret],
  },
  async (event) => {
    const docId = event.params.docId;
    await notifyLaravelDelete("crms", docId);
    logger.info("Mirrored Firestore delete to Laravel (crm).", {docId});
  },
);

exports.onUserDocumentDeleted = onDocumentDeleted(
  {
    document: "users/{docId}",
    secrets: [firestoreSyncSecret],
  },
  async (event) => {
    const docId = event.params.docId;
    await notifyLaravelDelete("users", docId);
    logger.info("Mirrored Firestore delete to Laravel (user).", {docId});
  },
);
