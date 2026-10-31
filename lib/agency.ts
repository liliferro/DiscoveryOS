import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { State } from "./store.ts";
import { defaultDiscovery } from "./discovery.ts";
import { validateConfig, type Tenant } from "./domain.ts";
import { landingFacts } from "./discovery-facts.ts";
const httpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
export const clientSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    industry: z.string().trim().min(2).max(120),
    pantone: z.string().trim().max(80),
    color: z.string().regex(/^#[a-f0-9]{6}$/i),
    logoUrl: z
      .string()
      .max(90000)
      .refine(
        (value) =>
          !value ||
          httpsUrl(value) ||
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value),
        "Usa un logo PNG, JPG o WebP, o un enlace HTTPS",
      ),
    objective: z.string().trim().min(10).max(2500),
    context: z.string().trim().max(11500),
    products: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(120),
          description: z.string().trim().min(5).max(1500),
        }),
      )
      .min(1)
      .max(12),
    cta: z.string().trim().min(2).max(100),
    contactType: z.enum(["whatsapp", "email", "url"]),
    contactValue: z.string().trim().min(3).max(1500),
  })
  .superRefine((value, ctx) => {
    const valid =
      value.contactType === "whatsapp"
        ? /^\+?[\d\s()-]+$/.test(value.contactValue) &&
          /^\d{8,15}$/.test(value.contactValue.replace(/\D/g, ""))
        : value.contactType === "email"
          ? z.email().safeParse(value.contactValue).success
          : httpsUrl(value.contactValue);
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["contactValue"],
        message:
          "Revisa el teléfono con código de país, el correo o el enlace HTTPS",
      });
    if (
      new Set(value.products.map((p) => p.name.toLowerCase())).size !==
      value.products.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["products"],
        message: "Los productos deben tener nombres únicos",
      });
  });
export type AgencyClient = z.infer<typeof clientSchema> & {
  id: string;
  createdAt: string;
};
export function contactUrl(
  client: Pick<AgencyClient, "contactType" | "contactValue">,
) {
  if (client.contactType === "whatsapp")
    return `https://wa.me/${client.contactValue.replace(/\D/g, "")}?text=${encodeURIComponent("Hola, terminé mi discovery y me gustaría recibir más información.")}`;
  return client.contactType === "url" ? client.contactValue : "";
}
export class AgencyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function agencyDashboard(state: State) {
  return {
    clients: (state.clients || []).map((client) => ({
      ...client,
      landings: state.tenants
        .filter((t) => t.clientId === client.id)
        .map((t) => ({
          id: t.id,
          name: t.landingName || t.draft.title,
          slug: t.slug,
          objective: t.draft.discovery?.objective || "Cuestionario predefinido",
          published:
            !t.deletedAt && t.published !== false && t.versions.length > 0,
          version: t.versions.at(-1)?.number || 0,
          runs: state.runs.filter((r) => r.tenantId === t.id).length,
          deletedAt: t.deletedAt,
        })),
    })),
  };
}
export function handleAgency(
  state: State,
  session: State["sessions"][number],
  path: string[],
  method: string,
  body: unknown,
) {
  state.clients ||= [];
  if (path.length === 2 && path[1] === "dashboard" && method === "GET")
    return agencyDashboard(state);
  if (path[1] === "clients" && path.length === 2 && method === "POST") {
    const client = {
      ...clientSchema.parse(body),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    state.clients.push(client);
    return { id: client.id };
  }
  if (path[1] === "clients" && path[2]) {
    const client = state.clients.find((c) => c.id === path[2]);
    if (!client) throw new AgencyError(404, "Cliente no disponible");
    if (path.length === 3 && method === "PUT") {
      Object.assign(client, clientSchema.parse(body));
      for (const landing of state.tenants.filter(
        (t) => t.clientId === client.id,
      ))
        Object.assign(landing, {
          name: client.name,
          color: client.color,
          logoUrl: client.logoUrl,
          industry: client.industry,
          cta: client.cta,
          services: client.products.map((p) => p.name),
        });
      return { ok: true };
    }
    if (path[3] === "landings" && path.length === 4 && method === "POST") {
      const input = z
        .object({
          name: z.string().trim().min(3).max(120),
          slug: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .min(3)
            .max(80),
          title: z.string().trim().min(3).max(120),
          description: z.string().trim().max(500),
          objective: z.string().trim().min(10).max(2500),
        })
        .parse(body);
      if (state.tenants.some((t) => t.slug === input.slug))
        throw new AgencyError(
          409,
          "Ese enlace ya está en uso. Elige otro identificador.",
        );
      const draft = validateConfig({
        title: input.title,
        description: input.description,
        ctaLabel: client.cta,
        bookingUrl: contactUrl(client),
        contactEmail: client.contactType === "email" ? client.contactValue : "",
        questions: structuredClone(state.tenants[0].draft.questions),
        discovery: {
          ...structuredClone(defaultDiscovery),
          enabled: true,
          objective: input.objective,
          context: `Empresa: ${client.name}. Sector: ${client.industry}. ${client.context || "La empresa quiere conocer las necesidades del visitante antes de proponer sus productos."}`,
          services: structuredClone(client.products),
        },
      });
      const landing: Tenant = {
        id: randomUUID(),
        clientId: client.id,
        name: client.name,
        landingName: input.name,
        slug: input.slug,
        color: client.color,
        logoUrl: client.logoUrl,
        industry: client.industry,
        cta: client.cta,
        services: client.products.map((p) => p.name),
        draft,
        versions: [],
        published: false,
      };
      const suggestedFacts = landingFacts(draft, landing);
      draft.loadingFacts = suggestedFacts.every(
        (fact) => fact.source === "Catálogo de la empresa",
      )
        ? client.products
            .map((product) => ({
              topic: product.name,
              text: product.description.slice(0, 400),
              source: "Información de la empresa",
              url: "",
            }))
            .filter((fact) => fact.text.length >= 10)
        : suggestedFacts;
      state.tenants.push(landing);
      return { id: landing.id };
    }
  }
  if (
    path[1] === "landings" &&
    path[2] &&
    path.length === 4 &&
    ["delete", "restore"].includes(path[3]) &&
    method === "POST"
  ) {
    const landing = state.tenants.find((t) => t.id === path[2]);
    if (!landing) throw new AgencyError(404, "Landing no disponible");
    if (path[3] === "delete") {
      const input = z
        .object({ confirmation: z.string().trim().min(1).max(120) })
        .parse(body);
      if (input.confirmation !== (landing.landingName || landing.draft.title))
        throw new AgencyError(
          422,
          "Escribe el nombre exacto de la landing para confirmar.",
        );
      landing.deletedAt ||= new Date().toISOString();
    } else {
      if (!landing.deletedAt) return { ok: true };
      delete landing.deletedAt;
      landing.published = false;
    }
    return { ok: true };
  }
  if (
    path[1] === "landings" &&
    path[2] &&
    path[3] === "publish" &&
    method === "POST"
  ) {
    const landing = state.tenants.find((t) => t.id === path[2]);
    if (!landing || landing.deletedAt)
      throw new AgencyError(404, "Landing no disponible");
    landing.versions.push({
      id: randomUUID(),
      number: landing.versions.length + 1,
      config: structuredClone(validateConfig(landing.draft)),
    });
    landing.published = true;
    return { ok: true };
  }
  if (path[1] === "switch" && method === "POST") {
    const input = z
      .object({ landingId: z.string().min(1).max(80) })
      .parse(body);
    const landing = state.tenants.find((t) => t.id === input.landingId);
    if (!landing) throw new AgencyError(404, "Landing no disponible");
    session.tenantId = landing.id;
    session.agencyAdmin = true;
    return { ok: true };
  }
  throw new AgencyError(404, "Recurso de agencia no disponible");
}
