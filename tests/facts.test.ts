import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dentalFacts,
  pickUnseenFact,
  landingFacts,
  rotateFact,
  loadingFactSchema,
} from "../lib/discovery-facts.ts";

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

test("Cada landing usa su banco público y reconoce los tratamientos por servicio", () => {
  const privateDescription = "Criterio interno que nunca debe mostrarse";
  const dental = landingFacts(
    {
      title: "Descubre tus opciones",
      discovery: {
        services: [
          { name: "Carillas", description: privateDescription } as {
            name: string;
          },
        ],
      },
    },
    { industry: "Salud" },
  );
  assert.equal(dental.length, 12);
  assert.ok(dental.every((f) => f.topic === "Carillas"));
  assert.ok(!JSON.stringify(dental).includes(privateDescription));
  const custom = {
    topic: "Café",
    text: "El café de esta selección se ofrece en grano.",
    source: "Catálogo",
    url: "",
  };
  const facts = landingFacts({
    title: "Carillas",
    loadingFacts: [custom, { ...custom }],
  });
  assert.equal(facts.length, 1);
  assert.equal(facts[0].topic, "Café");
  assert.deepEqual(
    facts,
    landingFacts({ title: "Otra landing", loadingFacts: [custom] }),
  );
  const other = landingFacts({
    title: "Equipo",
    discovery: { services: [{ name: "Asesoría" }] },
  });
  assert.ok(other.every((f) => !/implante|carilla/i.test(f.text)));
});

test("Al agotar un banco sigue mostrando facts y evita repetir el último", () => {
  const pool = dentalFacts.slice(0, 3);
  const seen = new Set<string>();
  let last: string | undefined;
  for (let i = 0; i < 40; i++) {
    const fact = rotateFact(pool, seen, last);
    assert.ok(fact);
    assert.notEqual(fact.id, last);
    last = fact.id;
  }
  assert.equal(rotateFact([], seen), null);
  assert.equal(
    loadingFactSchema.safeParse({
      topic: "Fuente",
      text: "Un dato educativo",
      source: "Fuente",
      url: "javascript:alert(1)",
    }).success,
    false,
  );
});
