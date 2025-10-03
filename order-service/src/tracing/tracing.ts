import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';

// Configure the service resource
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'order-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
);

// Configure Jaeger exporter
const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

// Configure trace provider
const provider = new NodeTracerProvider({
  resource: resource,
});

// Add span processors
provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));

// Enable console exporter for debugging
if (process.env.OTEL_DEBUG === 'true') {
  provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
}

// Register the provider globally
provider.register();

// Register instrumentations
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({
      requestHook: (span, request) => {
        span.setAttribute('http.request.body', JSON.stringify(request.body || {}));
      },
    }),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    ...getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable fs instrumentation to reduce noise
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-net': {
        enabled: false,
      },
    }),
  ],
});

// Start the SDK
export const startTracing = async () => {
  try {
    console.log('OpenTelemetry tracing initialized for order-service');
    console.log('Jaeger endpoint:', process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces');
  } catch (error) {
    console.error('Error initializing tracing', error);
  }
};

// Gracefully shutdown tracing
export const stopTracing = async () => {
  try {
    await provider.shutdown();
    console.log('OpenTelemetry tracing terminated');
  } catch (error) {
    console.error('Error terminating tracing', error);
  }
};

// Helper function to create custom spans
export function createSpan(name: string, attributes?: Record<string, any>) {
  const tracer = trace.getTracer('order-service', '1.0.0');
  const span = tracer.startSpan(name, {
    kind: SpanKind.INTERNAL,
    attributes: attributes,
  });
  
  return span;
}

// Helper to run function with span
export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, any>,
  fn: () => Promise<T>,
): Promise<T> {
  const span = createSpan(spanName, attributes);
  
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}