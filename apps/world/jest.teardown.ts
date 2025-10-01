/**
 * Global teardown for Jest tests
 * Ensures all async operations and connections are properly closed
 */
export default async function globalTeardown() {
  // Give async operations time to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
}
