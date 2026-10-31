"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Building2,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  Pencil,
  Layers,
  Check,
  Copy,
  Download,
} from "lucide-react";
import { api } from "@/lib/client";
import type { AgencyClient, agencyDashboard } from "@/lib/agency";
type Data = ReturnType<typeof agencyDashboard>;
type ClientForm = Omit<AgencyClient, "id" | "createdAt">;
const emptyClient = (): ClientForm => ({
  name: "",
  industry: "",
  pantone: "",
  color: "#6756d8",
  logoUrl: "",
  objective: "",
  context: "",
  products: [{ name: "", description: "" }],
  cta: "Solicitar información",
  contactType: "whatsapp",
  contactValue: "",
});
const emptyLanding = () => ({
  name: "",
  slug: "",
  title: "",
  description: "",
  objective: "",
});
const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");

export default function AgencyPanel({
  onOpenLanding,
}: {
  onOpenLanding: (id: string) => Promise<void>;
}) {
  const [data, setData] = useState<Data>();
  const [selectedId, setSelectedId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient);
  const [creatingLanding, setCreatingLanding] = useState(false);
  const [landingForm, setLandingForm] = useState(emptyLanding);
  const [slugEdited, setSlugEdited] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = data?.clients.find((client) => client.id === selectedId);
  useEffect(() => {
    let active = true;
    api<Data>("agency/dashboard")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setData(await api<Data>("agency/dashboard"));
  }
  async function downloadResults(
    scope: { clientId?: string; landingId?: string } = {},
  ) {
    const response = await fetch(
      `/api/v1/agency/export?${new URLSearchParams(scope)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      const data = await response.json();
      throw Error(data.message || "No se pudo exportar");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "discovery-resultados.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Exportación descargada. Puedes abrir el CSV en Excel o Google Sheets.",
    );
  }
  function edit(client?: AgencyClient) {
    setClientForm(
      client
        ? {
            name: client.name,
            industry: client.industry,
            pantone: client.pantone,
            color: client.color,
            logoUrl: client.logoUrl,
            objective: client.objective,
            context: client.context,
            products: structuredClone(client.products),
            cta: client.cta,
            contactType: client.contactType,
            contactValue: client.contactValue,
          }
        : emptyClient(),
    );
    setEditingId(client?.id || "new");
    setError("");
    setMessage("");
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5_000_000
    ) {
      setError("Elige un logo PNG, JPG o WebP de hasta 5 MB.");
      return;
    }
    await perform(async () => {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const logoUrl = canvas.toDataURL("image/webp", 0.8);
      if (logoUrl.length > 90000)
        throw Error(
          "Este logo tiene demasiado detalle. Usa una imagen más pequeña o su URL HTTPS.",
        );
      setClientForm((current) => ({ ...current, logoUrl }));
    });
  }
  const totalLandings =
    data?.clients.reduce((sum, client) => sum + client.landings.length, 0) || 0;
  return (
    <section className="agency-panel">
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="success">
          <Check size={16} />
          {message}
        </div>
      )}
      {editingId ? (
        <form
          className="agency-editor card"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              const created = await api<{ id?: string }>(
                editingId === "new"
                  ? "agency/clients"
                  : `agency/clients/${editingId}`,
                editingId === "new" ? "POST" : "PUT",
                clientForm,
              );
              await reload();
              setSelectedId(created.id || editingId);
              setEditingId(undefined);
              setMessage("Registro del cliente guardado.");
            });
          }}
        >
          <div className="agency-section-heading">
            <div>
              <span className="eyebrow">REGISTRO DEL CLIENTE</span>
              <h2>
                {editingId === "new"
                  ? "Una nueva marca, nuevas posibilidades."
                  : "La identidad de tu cliente."}
              </h2>
            </div>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => setEditingId(undefined)}
            >
              Cancelar
            </button>
          </div>
          <div className="agency-form-grid">
            <label>
              Nombre del cliente
              <input
                required
                maxLength={100}
                value={clientForm.name}
                onChange={(e) =>
                  setClientForm({ ...clientForm, name: e.target.value })
                }
              />
            </label>
            <label>
              Sector o industria
              <input
                required
                maxLength={120}
                value={clientForm.industry}
                onChange={(e) =>
                  setClientForm({ ...clientForm, industry: e.target.value })
                }
                placeholder="Ej. Clínica odontológica"
              />
            </label>
            <label>
              Referencia Pantone
              <input
                maxLength={80}
                value={clientForm.pantone}
                onChange={(e) =>
                  setClientForm({ ...clientForm, pantone: e.target.value })
                }
                placeholder="Ej. PANTONE 320 C"
              />
            </label>
            <label>
              Color digital de la marca
              <div className="agency-color-input">
                <input
                  aria-label="Selector de color"
                  type="color"
                  value={clientForm.color}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, color: e.target.value })
                  }
                />
                <input
                  aria-label="Color HEX"
                  required
                  pattern="#[a-fA-F0-9]{6}"
                  value={clientForm.color}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, color: e.target.value })
                  }
                />
              </div>
              <small>
                Introduce el HEX aprobado para la web; la referencia Pantone se
                conserva por separado.
              </small>
            </label>
            <label>
              Subir logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => void uploadLogo(e.target.files?.[0])}
              />
              <small>PNG, JPG o WebP. Se adapta para cargar rápidamente.</small>
            </label>
            <label>
              O pegar enlace del logo
              <input
                type={clientForm.logoUrl.startsWith("data:") ? "text" : "url"}
                value={
                  clientForm.logoUrl.startsWith("data:")
                    ? ""
                    : clientForm.logoUrl
                }
                onChange={(e) =>
                  setClientForm({ ...clientForm, logoUrl: e.target.value })
                }
                placeholder={
                  clientForm.logoUrl.startsWith("data:")
                    ? "Logo subido. Pega una URL para reemplazarlo."
                    : "https://..."
                }
              />
            </label>
          </div>
          {clientForm.logoUrl && (
            <div className="agency-logo-preview">
              <Image
                src={clientForm.logoUrl}
                alt="Vista previa del logo"
                width={140}
                height={70}
                unoptimized
              />
              <button
                className="text-link"
                type="button"
                onClick={() => setClientForm({ ...clientForm, logoUrl: "" })}
              >
                Quitar logo
              </button>
            </div>
          )}
          <label>
            Objetivo general del cliente
            <textarea
              required
              minLength={10}
              maxLength={2500}
              value={clientForm.objective}
              onChange={(e) =>
                setClientForm({ ...clientForm, objective: e.target.value })
              }
              placeholder="Qué quiere lograr y qué necesita comprender de sus prospectos."
            />
          </label>
          <label>
            Contexto de la empresa
            <textarea
              maxLength={11500}
              value={clientForm.context}
              onChange={(e) =>
                setClientForm({ ...clientForm, context: e.target.value })
              }
              placeholder="Diferenciales, público, alcance, información confirmada y límites comerciales."
            />
          </label>
          <div className="agency-section-heading">
            <div>
              <h3>Productos y servicios</h3>
              <p>Este catálogo alimenta las nuevas conversaciones con IA.</p>
            </div>
            <button
              type="button"
              className="button secondary"
              disabled={clientForm.products.length >= 12}
              onClick={() =>
                setClientForm({
                  ...clientForm,
                  products: [
                    ...clientForm.products,
                    { name: "", description: "" },
                  ],
                })
              }
            >
              <Plus size={15} />
              Añadir producto
            </button>
          </div>
          {clientForm.products.map((product, index) => (
            <div className="agency-product" key={index}>
              <label>
                Producto o servicio {index + 1}
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={product.name}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      products: clientForm.products.map((p, i) =>
                        i === index ? { ...p, name: e.target.value } : p,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Descripción {index + 1}
                <textarea
                  required
                  minLength={5}
                  maxLength={1500}
                  value={product.description}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      products: clientForm.products.map((p, i) =>
                        i === index ? { ...p, description: e.target.value } : p,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="text-link"
                disabled={clientForm.products.length === 1}
                onClick={() =>
                  setClientForm({
                    ...clientForm,
                    products: clientForm.products.filter((_, i) => i !== index),
                  })
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <div className="agency-form-grid">
            <label>
              Texto del call to action
              <input
                required
                minLength={2}
                maxLength={100}
                value={clientForm.cta}
                onChange={(e) =>
                  setClientForm({ ...clientForm, cta: e.target.value })
                }
                placeholder="Ej. Agendar mi valoración"
              />
            </label>
            <label>
              Forma de contacto
              <select
                value={clientForm.contactType}
                onChange={(e) =>
                  setClientForm({
                    ...clientForm,
                    contactType: e.target.value as ClientForm["contactType"],
                    contactValue: "",
                  })
                }
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Correo electrónico</option>
                <option value="url">Agenda o enlace web</option>
              </select>
            </label>
            <label>
              {clientForm.contactType === "whatsapp"
                ? "WhatsApp con código de país"
                : clientForm.contactType === "email"
                  ? "Correo de contacto"
                  : "Enlace de contacto"}
              <input
                required
                type={
                  clientForm.contactType === "email"
                    ? "email"
                    : clientForm.contactType === "url"
                      ? "url"
                      : "tel"
                }
                value={clientForm.contactValue}
                onChange={(e) =>
                  setClientForm({ ...clientForm, contactValue: e.target.value })
                }
                placeholder={
                  clientForm.contactType === "whatsapp"
                    ? "+525523153249"
                    : clientForm.contactType === "email"
                      ? "equipo@cliente.com"
                      : "https://..."
                }
              />
            </label>
          </div>
          <p className="small muted">
            Cada landing recibe una copia del objetivo, catálogo y contacto al
            crearla. Después puedes ajustar su conversación y publicar sus
            cambios de forma independiente. La identidad visual del cliente se
            comparte entre sus landings.
          </p>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cliente"}
          </button>
        </form>
      ) : selected ? (
        <>
          <button
            className="text-link"
            onClick={() => {
              setSelectedId(undefined);
              setCreatingLanding(false);
              setMessage("");
            }}
          >
            <ArrowLeft size={16} />
            Todos los clientes
          </button>
          <div
            className="agency-client-hero card"
            style={{ "--client-color": selected.color } as React.CSSProperties}
          >
            <div className="agency-brand-mark">
              {selected.logoUrl ? (
                <Image
                  src={selected.logoUrl}
                  alt={`Logo de ${selected.name}`}
                  width={90}
                  height={70}
                  unoptimized
                />
              ) : (
                <Building2 size={32} />
              )}
            </div>
            <div>
              <span className="eyebrow">{selected.industry}</span>
              <h2>{selected.name}</h2>
              <p>{selected.objective}</p>
              <div className="agency-pills">
                <span>
                  <i style={{ background: selected.color }} />
                  {selected.pantone || selected.color}
                </span>
                <span>{selected.products.length} productos</span>
                <span>
                  {selected.contactType === "whatsapp"
                    ? "WhatsApp"
                    : selected.contactType === "email"
                      ? "Correo"
                      : "Web"}
                  : {selected.contactValue || "Pendiente"}
                </span>
              </div>
            </div>
            <div className="agency-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void perform(() => downloadResults({ clientId: selected.id }))
                }
              >
                <Download size={15} />
                Exportar resultados del cliente
              </button>
              <button
                className="button secondary"
                onClick={() => edit(selected)}
              >
                <Pencil size={15} />
                Editar cliente
              </button>
            </div>
          </div>
          <div className="agency-section-heading">
            <div>
              <h2>Una landing para cada objetivo.</h2>
              <p>Conversaciones, enlaces y resultados independientes.</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setCreatingLanding(true);
                setLandingForm({
                  ...emptyLanding(),
                  objective: selected.objective,
                });
                setSlugEdited(false);
              }}
            >
              <Plus size={16} />
              Nueva landing
            </button>
          </div>
          {creatingLanding && (
            <form
              className="agency-editor card"
              onSubmit={(event) => {
                event.preventDefault();
                void perform(async () => {
                  await api(
                    `agency/clients/${selected.id}/landings`,
                    "POST",
                    landingForm,
                  );
                  await reload();
                  setCreatingLanding(false);
                  setMessage(
                    "Landing creada como borrador. Personaliza la conversación antes de publicarla.",
                  );
                });
              }}
            >
              <h3>Crea una conversación con propósito.</h3>
              <div className="agency-form-grid">
                <label>
                  Nombre interno de la landing
                  <input
                    required
                    minLength={3}
                    maxLength={120}
                    value={landingForm.name}
                    onChange={(e) =>
                      setLandingForm({
                        ...landingForm,
                        name: e.target.value,
                        title: e.target.value,
                        ...(!slugEdited
                          ? {
                              slug: slugify(
                                selected.name.slice(0, 32) +
                                  "-" +
                                  e.target.value,
                              ),
                            }
                          : {}),
                      })
                    }
                  />
                </label>
                <label>
                  Identificador del enlace
                  <input
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    minLength={3}
                    maxLength={80}
                    value={landingForm.slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setLandingForm({ ...landingForm, slug: e.target.value });
                    }}
                  />
                  <small>/s/{landingForm.slug || "cliente-objetivo"}</small>
                </label>
              </div>
              <label>
                Título que verá el visitante
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  value={landingForm.title}
                  onChange={(e) =>
                    setLandingForm({ ...landingForm, title: e.target.value })
                  }
                />
              </label>
              <label>
                Objetivo de esta landing
                <textarea
                  required
                  minLength={10}
                  maxLength={2500}
                  value={landingForm.objective}
                  onChange={(e) =>
                    setLandingForm({
                      ...landingForm,
                      objective: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Introducción para el visitante
                <textarea
                  maxLength={500}
                  value={landingForm.description}
                  onChange={(e) =>
                    setLandingForm({
                      ...landingForm,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <div className="agency-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Creando…" : "Crear landing"}
                </button>
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => setCreatingLanding(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          <div className="agency-landing-grid">
            {selected.landings.map((landing) => (
              <article className="agency-landing card" key={landing.id}>
                <div className="agency-section-heading">
                  <span
                    className={
                      landing.published ? "tag agency-published" : "tag"
                    }
                  >
                    {landing.published ? "Publicada" : "Borrador"}
                  </span>
                  <Layers size={20} />
                </div>
                <h3>{landing.name}</h3>
                <p>{landing.objective}</p>
                <small>/s/{landing.slug}</small>
                <div className="agency-landing-meta">
                  <span>{landing.runs} conversaciones</span>
                  <span>Versión {landing.version}</span>
                </div>
                <div className="agency-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void perform(() => onOpenLanding(landing.id))
                    }
                  >
                    <Pencil size={14} />
                    Editar conversación
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await api(
                          `agency/landings/${landing.id}/publish`,
                          "POST",
                          {},
                        );
                        await reload();
                        setMessage(
                          "Landing publicada. Su enlace ya está disponible.",
                        );
                      })
                    }
                  >
                    {landing.published ? "Publicar cambios" : "Publicar"}
                  </button>
                </div>
                <button
                  className="text-link"
                  style={{ marginTop: 16 }}
                  aria-label={`Exportar resultados de ${landing.name}`}
                  disabled={busy}
                  onClick={() =>
                    void perform(() =>
                      downloadResults({ landingId: landing.id }),
                    )
                  }
                >
                  <Download size={14} />
                  Exportar CSV
                </button>
                {landing.published && (
                  <div className="agency-actions">
                    <a
                      className="text-link"
                      href={`/s/${landing.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir landing <ArrowUpRight size={15} />
                    </a>
                    <button
                      className="text-link"
                      onClick={() =>
                        void perform(async () => {
                          await navigator.clipboard.writeText(
                            `${location.origin}/s/${landing.slug}`,
                          );
                          setMessage("Enlace copiado.");
                        })
                      }
                    >
                      <Copy size={14} />
                      Copiar enlace
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {!selected.landings.length && (
            <div className="agency-empty card">
              <Layers size={34} />
              <h3>Su primera landing empieza con un objetivo.</h3>
              <p>
                Crea una para cada campaña, producto o público que quieras
                explorar.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="agency-overview">
            <div className="card">
              <span>Clientes</span>
              <strong>{data?.clients.length || 0}</strong>
            </div>
            <div className="card">
              <span>Landings creadas</span>
              <strong>{totalLandings}</strong>
            </div>
            <div className="card">
              <span>Landings publicadas</span>
              <strong>
                {data?.clients.reduce(
                  (sum, client) =>
                    sum + client.landings.filter((l) => l.published).length,
                  0,
                ) || 0}
              </strong>
            </div>
          </div>
          <div className="agency-section-heading">
            <div>
              <h2>Tus clientes. Sus próximas oportunidades.</h2>
              <p>
                Una identidad por cliente. Tantas conversaciones como objetivos.
              </p>
            </div>
            <div className="agency-actions">
              <button
                className="button secondary"
                disabled={busy || !data}
                onClick={() => void perform(() => downloadResults())}
              >
                <Download size={15} />
                Exportar todos los resultados
              </button>
              <button className="button primary" onClick={() => edit()}>
                <Plus size={17} />
                Nuevo cliente
              </button>
            </div>
          </div>
          <input
            className="agency-search"
            aria-label="Buscar clientes"
            placeholder="Buscar por nombre o sector…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!data && !error && <p role="status">Cargando clientes…</p>}
          <div className="agency-client-grid">
            {data?.clients
              .filter((c) =>
                `${c.name} ${c.industry}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((client) => (
                <button
                  className="agency-client-card card"
                  key={client.id}
                  onClick={() => {
                    setSelectedId(client.id);
                    setMessage("");
                  }}
                  style={
                    { "--client-color": client.color } as React.CSSProperties
                  }
                >
                  <div className="agency-section-heading">
                    <div className="agency-brand-mark">
                      {client.logoUrl ? (
                        <Image
                          src={client.logoUrl}
                          alt={`Logo de ${client.name}`}
                          width={80}
                          height={50}
                          unoptimized
                        />
                      ) : (
                        <Building2 size={25} />
                      )}
                    </div>
                    <ArrowUpRight size={20} />
                  </div>
                  <h3>{client.name}</h3>
                  <small>{client.industry}</small>
                  <p>{client.objective}</p>
                  <div className="agency-pills">
                    <span>{client.landings.length} landings</span>
                    <span>{client.products.length} productos</span>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
