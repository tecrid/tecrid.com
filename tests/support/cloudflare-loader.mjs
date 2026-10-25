// Test-only shim for built Workers imported by Node. Never loaded by the application.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript," + encodeURIComponent("export const env = globalThis.__TECRID_WORKER_TEST_BINDINGS__ ||= {};"), shortCircuit: true };
  return nextResolve(specifier, context);
}
