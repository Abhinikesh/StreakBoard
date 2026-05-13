/**
 * sendPushNotification.js
 * -----------------------
 * Sends an Expo push notification to a single user.
 *
 * Requires the User model to have an `expoPushToken` field, OR
 * you can swap the token-lookup for your own token store.
 *
 * Usage:
 *   import sendPushNotification from '../utils/sendPushNotification.js';
 *   await sendPushNotification(userId, 'Title', 'Body text', { extraData: 1 });
 */

import User from '../models/User.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * @param {string} userId    - MongoDB ObjectId string of the recipient
 * @param {string} title     - Notification title
 * @param {string} body      - Notification body text
 * @param {object} [data={}] - Optional extra data payload
 */
export default async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const user = await User.findById(userId).select('expoPushToken pushNotificationsEnabled').lean();

    // Bail out if no token or user opted out
    if (!user?.expoPushToken) return;
    if (user.pushNotificationsEnabled === false) return;

    const token = user.expoPushToken;

    // Validate token format (ExponentPushToken[...] or ea:...)
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ea:')) {
      console.warn('[sendPushNotification] Invalid Expo push token format:', token);
      return;
    }

    const message = {
      to:    token,
      sound: 'default',
      title,
      body,
      data,
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    // Log any delivery errors (but don't throw — never let push failures crash routes)
    if (result?.data?.status === 'error') {
      console.warn('[sendPushNotification] Expo error:', result.data.message, '| token:', token);
    }
  } catch (err) {
    // Swallow silently — push failures must never break the API response
    console.error('[sendPushNotification] Unexpected error:', err.message);
  }
}
