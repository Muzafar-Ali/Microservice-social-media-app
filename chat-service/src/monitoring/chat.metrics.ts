import client from 'prom-client';

export const chatSocketConnectionsTotal = new client.Counter({
  name: 'chat_socket_connections_total',
  help: 'Total authenticated Socket.IO connections accepted by chat-service',
});

export const chatSocketDisconnectionsTotal = new client.Counter({
  name: 'chat_socket_disconnections_total',
  help: 'Total Socket.IO disconnections observed by chat-service',
});

export const chatSocketActiveConnections = new client.Gauge({
  name: 'chat_socket_active_connections',
  help: 'Current active Socket.IO connections tracked by chat-service',
});

export const chatSocketEventsTotal = new client.Counter({
  name: 'chat_socket_events_total',
  help: 'Total chat socket events processed by event name and result',
  labelNames: ['event_name', 'result'],
});

export function registerChatMetrics(register: client.Registry) {
  register.registerMetric(chatSocketConnectionsTotal);
  register.registerMetric(chatSocketDisconnectionsTotal);
  register.registerMetric(chatSocketActiveConnections);
  register.registerMetric(chatSocketEventsTotal);
}
