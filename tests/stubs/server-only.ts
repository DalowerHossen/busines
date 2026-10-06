// tests/stubs/server-only.ts
// The real module exists to make a build fail when server code is imported
// into a browser bundle. Under the test runner there is no bundle, so it
// stands in as nothing at all.

export {};
