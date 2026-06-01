/**
 * SugarDry IoT — MQTT Service
 * Handles HiveMQ Cloud WebSocket connection
 *
 * Dependencies: mqtt.js (loaded via CDN in index.html)
 * Requires: config.js loaded first
 *
 * Arsitektur:
 *   ESP32 --MQTT(TLS)--> HiveMQ Cloud <--WSS-- Dashboard (ini)
 *   Dashboard juga bisa publish command ke ESP32 via HiveMQ
 */

const MQTTService = (() => {
  let client = null;
  let connected = false;
  let messageHandlers = {};
  let statusCallback = null;

  // ===== INIT =====
  function init() {
    // Check if mqtt.js is loaded
    if (typeof mqtt === 'undefined') {
      console.warn('⚠️ mqtt.js not loaded — skipping MQTT init');
      return;
    }

    // Check if config has real values
    if (CONFIG.mqtt.broker.includes('YOUR_CLUSTER_URL')) {
      console.warn('⚠️ MQTT config not set — using placeholder values');
      return;
    }

    connect();
  }

  function connect() {
    try {
      console.log('📡 Connecting to MQTT broker...');

      client = mqtt.connect(CONFIG.mqtt.broker, {
        username: CONFIG.mqtt.username,
        password: CONFIG.mqtt.password,
        clientId: CONFIG.mqtt.clientId,
        clean: true,
        reconnectPeriod: CONFIG.mqtt.reconnectPeriod,
        keepalive: CONFIG.mqtt.keepalive,
        connectTimeout: 10000,
        // HiveMQ Cloud requires TLS — WSS handles this
        protocolVersion: 4,
      });

      // ===== EVENT HANDLERS =====

      client.on('connect', () => {
        console.log('✅ MQTT Connected to HiveMQ Cloud');
        connected = true;
        updateStatus(true);

        // Subscribe to all oven topics (ESP32 → Dashboard)
        client.subscribe('oven/#', { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ MQTT Subscribe error:', err);
          } else {
            console.log('📡 Subscribed to oven/#');
          }
        });
      });

      client.on('message', (topic, message) => {
        const payload = message.toString();
        // Route to registered handlers
        if (messageHandlers[topic]) {
          messageHandlers[topic].forEach((handler) => handler(payload, topic));
        }
        // Also call wildcard handlers
        if (messageHandlers['*']) {
          messageHandlers['*'].forEach((handler) => handler(payload, topic));
        }
      });

      client.on('error', (err) => {
        console.error('❌ MQTT Error:', err.message);
        connected = false;
        updateStatus(false);
      });

      client.on('close', () => {
        console.warn('🔌 MQTT Connection closed');
        connected = false;
        updateStatus(false);
      });

      client.on('reconnect', () => {
        console.log('🔄 MQTT Reconnecting...');
        updateStatus(false, 'reconnecting');
      });

      client.on('offline', () => {
        console.warn('📴 MQTT Offline');
        connected = false;
        updateStatus(false);
      });
    } catch (err) {
      console.error('❌ MQTT Connect error:', err);
    }
  }

  // ===== STATUS =====
  function updateStatus(isConnected, extra) {
    connected = isConnected;
    if (statusCallback) {
      statusCallback(isConnected, extra);
    }
  }

  /**
   * Register a callback for MQTT connection status changes
   * @param {function} callback - (isConnected: boolean, extra?: string) => void
   */
  function onStatusChange(callback) {
    statusCallback = callback;
  }

  function isConnected() {
    return connected;
  }

  // ===== MESSAGE HANDLERS =====

  /**
   * Register a handler for a specific MQTT topic
   * @param {string} topic - MQTT topic or '*' for all messages
   * @param {function} handler - (payload: string, topic: string) => void
   */
  function on(topic, handler) {
    if (!messageHandlers[topic]) {
      messageHandlers[topic] = [];
    }
    messageHandlers[topic].push(handler);
  }

  /**
   * Remove a handler for a topic
   * @param {string} topic
   * @param {function} handler
   */
  function off(topic, handler) {
    if (messageHandlers[topic]) {
      messageHandlers[topic] = messageHandlers[topic].filter((h) => h !== handler);
    }
  }

  // ===== PUBLISH =====

  /**
   * Publish a message to a topic
   * @param {string} topic
   * @param {string|object} payload - if object, will be JSON.stringified
   * @param {object} options - { qos, retain }
   */
  function publish(topic, payload, options = {}) {
    if (!client || !connected) {
      console.warn('⚠️ MQTT not connected — cannot publish');
      return false;
    }

    const message = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);

    client.publish(topic, message, {
      qos: options.qos || 1,
      retain: options.retain || false,
    });

    return true;
  }

  // ===== CONVENIENCE METHODS =====

  /**
   * Send blower mode change command to ESP32
   * @param {string} mode - 'Efisien', 'Turbo', or 'Custom'
   */
  function setBlowerMode(mode) {
    return publish(CONFIG.topics.blowerMode, mode);
  }

  /**
   * Send batch start command to ESP32
   * @param {object} batchData - pre-batch data
   */
  function sendBatchStart(batchData) {
    return publish(CONFIG.topics.batchInput, batchData);
  }

  /**
   * Send batch stop command to ESP32
   * @param {string} batchId
   */
  function sendBatchStop(batchId) {
    return publish(CONFIG.topics.batchStop, { batchId, command: 'STOP' });
  }

  /**
   * Disconnect from MQTT broker
   */
  function disconnect() {
    if (client) {
      client.end();
      connected = false;
      updateStatus(false);
      console.log('🔌 MQTT Disconnected');
    }
  }

  // ===== PUBLIC API =====
  return {
    init,
    isConnected,
    onStatusChange,
    on,
    off,
    publish,
    // Convenience
    setBlowerMode,
    sendBatchStart,
    sendBatchStop,
    disconnect,
  };
})();
