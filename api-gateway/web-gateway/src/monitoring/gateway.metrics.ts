import client from 'prom-client';

export const gatewayProxyRequestsTotal = new client.Counter({
  name: 'gateway_proxy_requests_total',
  help: 'Total gateway proxy requests by target service, route, result, and status code',
  labelNames: ['target_service', 'route', 'result', 'status_code'],
});

export function registerGatewayMetrics(register: client.Registry) {
  register.registerMetric(gatewayProxyRequestsTotal);
}
