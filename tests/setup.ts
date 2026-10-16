// tests/setup.ts
// Each test starts from a clean rate-limit store.
//
// The counters live in module state — that is the whole point of the in-memory
// backend — so without this reset one test's requests would spend the next test's
// budget, and a test that asserts a limit would really be asserting the previous
// test's arithmetic. Resetting per test is what a fresh server instance would
// look like.
import { beforeEach } from "vitest";
import { resetInMemoryCounters } from "@/lib/rateLimit";

beforeEach(() => {
  resetInMemoryCounters();
});
