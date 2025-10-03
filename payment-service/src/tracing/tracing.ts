import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Tracing is temporarily disabled to focus on core functionality
// The payment service works without distributed tracing

export const startTracing = async () => {
  console.log('Payment service started (tracing disabled)');
};

export const stopTracing = async () => {
  console.log('Payment service stopped');
};

export function createSpan(name: string, attributes?: Record<string, any>) {
  const tracer = trace.getTracer('payment-service', '1.0.0');
  return tracer.startSpan(name, {
    kind: SpanKind.INTERNAL,
    attributes: attributes,
  });
}

export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, any>,
  fn: () => Promise<T>,
): Promise<T> {
  // Simply execute the function without tracing
  return fn();
}