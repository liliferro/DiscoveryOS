import { test } from "node:test";
import assert from "node:assert/strict";
import { dentalMapSchema, dentalMapSummary } from "../lib/dental-map.ts";

test("El mapa solo admite piezas permanentes FDI únicas y distingue ausencia, preocupación y omisión", () => {
  const map = dentalMapSchema.parse({
    skipped: false,
    teeth: [
      { number: 11, status: "missing" },
      { number: 46, status: "concern" },
    ],
  });
  assert.match(dentalMapSummary(map), /ausentes.*11/);
  assert.match(dentalMapSummary(map), /preocupación.*46/);
  for (const teeth of [
    [{ number: 19, status: "missing" }],
    [{ number: 11, status: "healthy" }],
    [map.teeth[0], map.teeth[0]],
  ])
    assert.equal(
      dentalMapSchema.safeParse({ skipped: false, teeth }).success,
      false,
    );
  assert.equal(
    dentalMapSchema.safeParse({ ...map, skipped: true }).success,
    false,
  );
  assert.match(dentalMapSummary({ skipped: true, teeth: [] }), /prefirió/);
  assert.match(dentalMapSummary({ skipped: false, teeth: [] }), /no señaló/);
});
