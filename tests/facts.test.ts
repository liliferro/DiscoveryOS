import { test } from "node:test";
import assert from "node:assert/strict";
import { dentalFacts, pickUnseenFact } from "../lib/discovery-facts.ts";

test("Los datos educativos se seleccionan al azar sin repetir y no se reciclan al agotar el catálogo", () => {
  const seen = new Set<string>();
  for (let i = 0; i < dentalFacts.length; i++) {
    const fact = pickUnseenFact(seen);
    assert.ok(fact);
    assert.equal(seen.has(fact.id), false);
    assert.equal(new URL(fact.url).protocol, "https:");
    seen.add(fact.id);
  }
  assert.equal(pickUnseenFact(seen), null);
  assert.notEqual(
    pickUnseenFact(new Set(), () => 0)?.id,
    pickUnseenFact(new Set(), () => 0.99)?.id,
  );
});
