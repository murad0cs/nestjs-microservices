import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Tracing is temporarily simplified to focus on core functionality
// The order service works without distributed tracing

export const startTracing = async () => {
  console.log('Order service started (tracing simplified)');
};

export const stopTracing = async () => {
  console.log('Order service stopped');
};

export function createSpan(name: string, attributes?: Record<string, any>) {
  const tracer = trace.getTracer('order-service', '1.0.0');
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