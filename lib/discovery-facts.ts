export type DiscoveryFact = {
  id: string;
  topic: string;
  text: string;
  source: string;
  url: string;
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
): DiscoveryFact | null {
  const available = dentalFacts.filter((fact) => !seen.has(fact.id));
  return available.length
    ? available[
        Math.min(
          available.length - 1,
          Math.max(0, Math.floor(random() * available.length)),
        )
      ]
    : null;
}
