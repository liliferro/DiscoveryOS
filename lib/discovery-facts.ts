import { z } from "zod";

export const loadingFactSchema = z.object({
  topic: z.string().trim().min(2).max(100),
  text: z.string().trim().min(10).max(400),
  source: z.string().trim().min(2).max(120),
  url: z
    .string()
    .max(2000)
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Usa una fuente HTTPS válida o deja el enlace vacío"),
});
export type LoadingFact = z.infer<typeof loadingFactSchema>;
export type DiscoveryFact = LoadingFact & {
  id: string;
};
const groups = [
  {
    topic: "Implantes dentales",
    source: "American Dental Association",
    url: "https://www.mouthhealthy.org/all-topics-a-z/implants/",
    texts: [
      "El hueso puede unirse a la superficie del implante mediante un proceso llamado osteointegración.",
      "Un implante sirve como anclaje para sostener el diente que reemplaza una pieza perdida.",
      "La corona que se coloca sobre un implante se diseña considerando el color y la forma de los otros dientes.",
      "Los implantes pueden sostener una corona, un puente o una prótesis, según el caso.",
      "La integración de un implante con el hueso requiere tiempo y puede llevar varios meses.",
      "El titanio es uno de los materiales utilizados en implantes por su compatibilidad con el cuerpo.",
    ],
  },
  {
    topic: "Implantes dentales",
    source: "FDA",
    url: "https://www.fda.gov/medical-devices/dental-devices/dental-implants-what-you-should-know",
    texts: [
      "El implante y la corona son piezas distintas: uno funciona como raíz artificial y la otra es la parte visible.",
      "Una pieza llamada pilar conecta el implante con el diente artificial.",
      "Los implantes necesitan higiene diaria y revisiones, igual que el resto de tu boca.",
      "La salud general y la de tu boca influyen en la planificación de un implante.",
      "El tiempo de cicatrización de un implante varía de una persona a otra.",
      "Antes de elegir un implante, conviene conversar con el profesional sobre sus beneficios, riesgos y alternativas.",
    ],
  },
  {
    topic: "Carillas",
    source: "American Dental Association",
    url: "https://www.mouthhealthy.org/all-topics-a-z/veneers",
    texts: [
      "Las carillas recubren la cara frontal del diente; una corona lo cubre de forma más completa.",
      "Existen carillas de porcelana y de resina compuesta, con características diferentes.",
      "El color de las carillas se elige junto con el dentista para buscar armonía con tu sonrisa.",
      "Las carillas de resina suelen ser más sencillas de reparar que las de porcelana.",
      "Antes de colocar carillas es importante tratar problemas como caries o enfermedad de las encías.",
      "Cuando las carillas requieren retirar esmalte, el cambio no es reversible: es importante resolver tus dudas antes.",
    ],
  },
  {
    topic: "Carillas",
    source: "Cleveland Clinic",
    url: "https://my.clevelandclinic.org/health/treatments/23522-dental-veneers",
    texts: [
      "Con cuidados adecuados, las carillas pueden durar en promedio entre 10 y 15 años. La duración varía según el caso.",
      "Las carillas se fabrican a medida para ajustarse a los dientes de cada persona.",
      "Las carillas pueden modificar la apariencia del color, la forma y algunos espacios entre dientes.",
      "Las carillas son una opción estética: no reemplazan una pieza dental perdida.",
      "Incluso con carillas, los dientes pueden desarrollar caries y necesitan cuidados diarios.",
      "Morder objetos duros puede dañar las carillas. Cuidarlas ayuda a conservarlas en buen estado.",
    ],
  },
];
export const dentalFacts: DiscoveryFact[] = groups.flatMap((group, category) =>
  group.texts.map((text, index) => ({
    id: `dental-v1-${category}-${index}`,
    topic: group.topic,
    text,
    source: group.source,
    url: group.url,
  })),
);
export function pickUnseenFact(
  seen: ReadonlySet<string>,
  random: () => number = Math.random,
  pool: readonly DiscoveryFact[] = dentalFacts,
): DiscoveryFact | null {
  const available = pool.filter((fact) => !seen.has(fact.id));
  return available.length
    ? available[
        Math.min(
          available.length - 1,
          Math.max(0, Math.floor(random() * available.length)),
        )
      ]
    : null;
}

// IDs are deterministic in both browser and server; edited facts count as new.
export function identifyFacts(facts: readonly LoadingFact[]): DiscoveryFact[] {
  const unique = new Map<string, DiscoveryFact>();
  for (const fact of facts) {
    const key = fact.text.trim().toLocaleLowerCase("es");
    if (unique.has(key)) continue;
    let hash = 2166136261;
    for (const char of JSON.stringify(fact))
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    unique.set(key, { ...fact, id: `fact-${(hash >>> 0).toString(36)}` });
  }
  return [...unique.values()];
}

export function landingFacts(
  config: {
    title: string;
    loadingFacts?: LoadingFact[];
    discovery?: { services: { name: string }[] };
  },
  brand?: { name?: string; industry?: string },
): DiscoveryFact[] {
  if (config.loadingFacts?.length) return identifyFacts(config.loadingFacts);
  const names = config.discovery?.services.map((s) => s.name) || [];
  const subject = `${config.title} ${names.join(" ")}`;
  const implant = /implant/i.test(subject);
  const veneer = /carilla|veneer/i.test(subject);
  if (implant || veneer)
    return dentalFacts.filter(
      (f) =>
        (implant && f.topic === "Implantes dentales") ||
        (veneer && f.topic === "Carillas"),
    );
  if (/odont|dental/i.test(`${subject} ${brand?.industry || ""}`))
    return dentalFacts;
  if (/seo|marketing|posicionamiento|página web|sitio web/i.test(subject))
    return identifyFacts(
      [
        "El SEO ayuda a los buscadores a comprender el contenido de una página y a las personas a encontrarla.",
        "Google descubre muchas páginas nuevas siguiendo enlaces desde otras páginas.",
        "Los cambios de SEO pueden tardar desde horas hasta meses en reflejarse en los resultados.",
        "Un sitemap reúne las direcciones de las páginas que quieres dar a conocer a los buscadores.",
        "Los títulos descriptivos ayudan a entender de qué trata una página antes de visitarla.",
        "El texto de un enlace ofrece contexto sobre la página a la que lleva.",
        "Un contenido útil, actualizado y fácil de leer ayuda a las personas a comprender tu oferta.",
        "Seguir buenas prácticas de SEO no garantiza aparecer en la primera posición de Google.",
      ].map((text) => ({
        topic: "Visibilidad digital",
        text,
        source: "Google Search Central",
        url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
      })),
    );
  // For uncatalogued sectors, use only public service names. Internal context,
  // objectives and qualification criteria must never become patient-facing copy.
  return identifyFacts(
    (names.length ? names : [config.title]).map((name) => ({
      topic: name,
      text: `${brand?.name || "Nuestro equipo"} incluye ${name} entre los temas que puedes explorar en esta conversación.`,
      source: "Catálogo de la empresa",
      url: "",
    })),
  );
}

export function rotateFact(
  pool: readonly DiscoveryFact[],
  seen: Set<string>,
  lastId?: string,
): DiscoveryFact | null {
  let fact = pickUnseenFact(seen, Math.random, pool);
  if (!fact && pool.length) {
    seen.clear();
    if (pool.length > 1 && lastId) seen.add(lastId);
    fact = pickUnseenFact(seen, Math.random, pool);
  }
  if (fact) seen.add(fact.id);
  return fact;
}
