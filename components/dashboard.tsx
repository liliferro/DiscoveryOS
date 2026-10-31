"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  AudioLines,
  LayoutDashboard,
  Layers,
  Settings2,
  Plug,
  Search,
  ChevronDown,
  Plus,
  Activity,
  Check,
  FileText,
  LogOut,
  ExternalLink,
  CircleHelp,
} from "lucide-react";
import type { Config, Run, Tenant, Question } from "@/lib/domain";
import { api } from "@/lib/client";
import ReportView from "./report";
import DiscoveryEditor from "./discovery-editor";
import AiConnectionPanel from "./ai-connection";
import LeadSummary from "./lead-summary";
type Data = { tenant: Tenant; runs: Run[] };
const tabs = [
  { name: "Vista general", icon: LayoutDashboard },
  { name: "Sesiones", icon: Layers },
  { name: "Constructor", icon: Settings2 },
  { name: "Integraciones", icon: Plug },
  { name: "Configuración", icon: Settings2 },
];
export default function Dashboard() {
  const [data, setData] = useState<Data>();
  const [tab, setTab] = useState("Vista general");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState(false);
  const [tenantId, setTenantId] = useState("mood");
  const [password, setPassword] = useState("discovery-demo");
  const [cloud, setCloud] = useState(false);
  const [email, setEmail] = useState("");
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [config, setConfig] = useState<Config>();
  const [selected, setSelected] = useState<Run>();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const next = await api<Data>("admin/dashboard");
      setData(next);
      setConfig(next.tenant.draft);
      setLogin(false);
    } catch {
      setLogin(true);
    }
  }
  useEffect(() => {
    let active = true;
    api<{ cloud: boolean }>("config")
      .then((c) => {
        if (active) {
          setCloud(c.cloud);
          if (c.cloud) setPassword("");
        }
      })
      .catch(() => {});
    api<Data>("admin/dashboard")
      .then((next) => {
        if (active) {
          setData(next);
          setConfig(next.tenant.draft);
          setLogin(false);
        }
      })
      .catch(() => {
        if (active) setLogin(true);
      });
    const onFocus = () => {
      api<Data>("admin/dashboard")
        .then((next) => {
          if (active) setData(next);
        })
        .catch(() => {
          if (active) setLogin(true);
        });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  async function action(fn: () => Promise<unknown>, text: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tenant = data?.tenant;
  const runs = data?.runs || [];
  const completed = runs.filter((r) => r.state === "completed_limited");
  function updateQuestion(index: number, patch: Partial<Question>) {
    setConfig((c) =>
      c
        ? {
            ...c,
            questions: c.questions.map((q, i) =>
              i === index ? { ...q, ...patch } : q,
            ),
          }
        : c,
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="wordmark" href="/">
          <span className="logo">
            <AudioLines size={23} />
          </span>
          discovery<span className="os">OS</span>
        </Link>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <button className="workspace" onClick={() => setLogin(true)}>
          <span className="avatar">{tenant?.name.slice(0, 1) || "M"}</span>
          <span>
            <strong>{tenant?.name || "Mood Agency"}</strong>
            <small>Workspace de demostración</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav>
          {tabs.map((t) => (
            <button
              className={tab === t.name ? "nav-item active" : "nav-item"}
              key={t.name}
              onClick={() => {
                setTab(t.name);
                setSelected(undefined);
                setMessage("");
              }}
            >
              <t.icon size={18} />
              {t.name}
              {t.name === "Sesiones" && (
                <span className="nav-count">{runs.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="live-dot" /> TU LABORATORIO DE DISCOVERY
            <h4>
              Ideas que se convierten
              <br />
              en próximos pasos.
            </h4>
            <p>Prueba todo el recorrido con datos de ejemplo.</p>
            <a href={`/s/${tenant?.slug || "mood"}`} target="_blank">
              Explorar sesión <ArrowUpRight size={15} />
            </a>
          </div>
          <button
            className="nav-item"
            onClick={() => {
              setTab("Integraciones");
              setSelected(undefined);
            }}
          >
            <CircleHelp size={18} />
            Guía del MVP
          </button>
          <div className="profile">
            <span className="profile-avatar">LF</span>
            <span>
              <strong>Cuenta del workspace</strong>
              <small>{cloud ? "Administración" : "Administración demo"}</small>
            </span>
            <button
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              onClick={() =>
                action(() => api("logout", "POST"), "Sesión cerrada")
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div>
            <span className="muted">Workspace</span>
            <span className="slash">/</span>
            {tab}
          </div>
          <div className="top-actions">
            <span className="demo-pill">
              <span /> {cloud ? "Entorno nube" : "Entorno local"}
            </span>
            <button
              className="profile-avatar small-avatar"
              aria-label="Cambiar empresa"
              onClick={() => setLogin(true)}
            >
              LF
            </button>
          </div>
        </header>
        <main className="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                DISCOVERY OS / {tenant?.name.toUpperCase() || "WORKSPACE"}
              </div>
              <h1>
                {selected
                  ? "Informe de discovery"
                  : tab === "Vista general"
                    ? "Todo empieza con una buena pregunta."
                    : tab}
              </h1>
              <p>
                {tab === "Vista general"
                  ? "Escucha mejor. Conecta los puntos. Descubre la siguiente oportunidad."
                  : "Tu metodología, tu marca y una nueva forma de descubrir oportunidades."}
              </p>
            </div>
            <a
              className="button primary"
              href={`/s/${tenant?.slug || "mood"}`}
              target="_blank"
            >
              Nueva discovery <Plus size={17} />
            </a>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="success" role="status">
              <Check size={16} />
              {message}
            </div>
          )}
          {selected?.conversation?.closed ? (
            <>
              <button
                className="text-link"
                onClick={() => setSelected(undefined)}
              >
                ← Volver a sesiones
              </button>
              <LeadSummary run={selected} internal />
            </>
          ) : selected?.report ? (
            <>
              <button
                className="text-link"
                onClick={() => setSelected(undefined)}
              >
                ← Volver a sesiones
              </button>
              <ReportView report={selected.report} />
            </>
          ) : (
            <>
              {tab === "Vista general" && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="eyebrow">
                        DE LA CONVERSACIÓN A LA CLARIDAD
                      </span>
                      <h2>
                        Menos suposiciones.
                        <br />
                        Más posibilidades.
                      </h2>
                      <p>
                        Convierte las respuestas de tus prospectos en un punto
                        de partida para crecer juntos.
                      </p>
                      <a
                        className="button dark"
                        href={`/s/${tenant?.slug || "mood"}`}
                        target="_blank"
                      >
                        Iniciar una discovery <ArrowRight size={17} />
                      </a>
                      <span className="hero-note">
                        Diseñada por ti. Impulsada por mejores preguntas.
                      </span>
                    </div>
                    <div className="orbit-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="orbit orbit-three" />
                      <span className="art-label art-label-one">
                        <span className="purple-dot" />
                        Contexto
                      </span>
                      <span className="art-label art-label-two">
                        <Activity size={15} />
                        Oportunidades
                      </span>
                      <div className="orbit-center">
                        <AudioLines size={49} />
                      </div>
                      <span className="orbit-spark spark-one" />
                      <span className="orbit-spark spark-two" />
                      <div className="art-caption">CONNECT THE DOTS.</div>
                    </div>
                  </section>
                  <div className="metrics">
                    {[
                      {
                        label: "Discoveries iniciadas",
                        value: runs.length,
                        foot: "Sesiones de este workspace",
                        icon: Layers,
                      },
                      {
                        label: "Informes listos",
                        value: completed.length,
                        foot: "Resultados de demostración",
                        icon: FileText,
                      },
                      {
                        label: "En proceso",
                        value: runs.filter((r) => r.state === "processing")
                          .length,
                        foot: "Trabajos persistentes locales",
                        icon: Activity,
                      },
                      {
                        label: "Versión publicada",
                        value: `v${tenant?.versions.at(-1)?.number || 1}`,
                        foot: "Cuestionario activo",
                        icon: Check,
                      },
                    ].map((m) => (
                      <article className="metric" key={m.label}>
                        <div>
                          <span>{m.label}</span>
                          <m.icon size={17} />
                        </div>
                        <strong>{m.value}</strong>
                        <small>{m.foot}</small>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {["Vista general", "Sesiones"].includes(tab) && (
                <section className="card sessions-card">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Discoveries recientes{" "}
                        <span className="count">{runs.length}</span>
                      </h2>
                      <p>Cada sesión, una nueva perspectiva.</p>
                    </div>
                    {tab === "Vista general" ? (
                      <button
                        className="text-link"
                        onClick={() => setTab("Sesiones")}
                      >
                        Ver todas <ArrowRight size={15} />
                      </button>
                    ) : (
                      <button className="text-link" onClick={() => refresh()}>
                        Actualizar
                      </button>
                    )}
                  </div>
                  <div className="table-tools">
                    <div className="filter-chips">
                      <span className="filter active">Todas las sesiones</span>
                      <span className="muted small">Solo {tenant?.name}</span>
                    </div>
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Buscar empresa"
                        placeholder={
                          tenant?.draft.discovery?.enabled
                            ? "Buscar perfil o servicio…"
                            : "Buscar empresa…"
                        }
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            {tenant?.draft.discovery?.enabled
                              ? "VISITANTE / INTERÉS"
                              : "EMPRESA"}
                          </th>
                          <th>DISCOVERY</th>
                          <th>ESTADO</th>
                          <th>FECHA</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {runs
                          .filter((r) =>
                            [
                              r.answers.company || "",
                              r.id,
                              ...(r.conversation?.decision?.segments.map(
                                (s) => s.service,
                              ) || []),
                              ...(r.conversation?.decision?.profile.map(
                                (p) => p.value,
                              ) || []),
                            ]
                              .join(" ")
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .slice(0, tab === "Vista general" ? 5 : 100)
                          .reverse()
                          .map((r) => (
                            <tr key={r.id}>
                              <td>
                                <div className="company-cell">
                                  <span className="company-icon">
                                    {String(r.answers.company || "S")
                                      .slice(0, 1)
                                      .toUpperCase()}
                                  </span>
                                  <div>
                                    <strong>
                                      {String(
                                        r.answers.company ||
                                          (r.conversation
                                            ? `Visitante ${r.id.slice(0, 6)}`
                                            : "Sin nombre todavía"),
                                      )}
                                    </strong>
                                    <small>
                                      {String(
                                        r.answers.sector ||
                                          r.conversation?.decision?.segments
                                            .map((s) => s.service)
                                            .join(" · ") ||
                                          "Sesión en curso",
                                      )}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {r.config.title}
                                <small className="table-small">
                                  Versión {r.version}
                                </small>
                              </td>
                              <td>
                                <span className={`status ${r.state}`}>
                                  {
                                    {
                                      draft: "Borrador",
                                      processing: "Procesando",
                                      completed_limited: r.conversation
                                        ? "Discovery IA"
                                        : "Informe demo",
                                      failed: "Requiere atención",
                                    }[r.state]
                                  }
                                </span>
                              </td>
                              <td>
                                {new Date(r.createdAt).toLocaleDateString(
                                  "es-MX",
                                  { day: "2-digit", month: "short" },
                                )}
                              </td>
                              <td>
                                {(r.report || r.conversation?.closed) &&
                                r.state === "completed_limited" ? (
                                  <button
                                    className="icon-button"
                                    aria-label="Ver informe"
                                    onClick={() => setSelected(r)}
                                  >
                                    <ArrowUpRight size={18} />
                                  </button>
                                ) : r.state === "failed" ? (
                                  <button
                                    className="text-link"
                                    onClick={() =>
                                      action(
                                        () =>
                                          api("admin/retry", "POST", {
                                            runId: r.id,
                                          }),
                                        "Reintento iniciado con proveedor simulado disponible",
                                      )
                                    }
                                  >
                                    Reintentar
                                  </button>
                                ) : (
                                  <a
                                    className="text-link"
                                    href={`/r/${r.id}`}
                                    target="_blank"
                                  >
                                    Abrir ↗
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!runs.length && (
                      <div className="empty">
                        <span className="empty-icon">
                          <Layers size={27} />
                        </span>
                        <h3>Tu primera oportunidad empieza aquí</h3>
                        <p>
                          Inicia una discovery y recorre la experiencia de tu
                          prospecto.
                          <br />
                          Los resultados aparecerán en este espacio.
                        </p>
                        <a
                          className="text-link"
                          href={`/s/${tenant?.slug || "mood"}`}
                          target="_blank"
                        >
                          Crear primera sesión <ArrowRight size={16} />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      <span className="live-dot" /> Datos locales · APIs
                      simuladas
                    </span>
                    <span>Un espacio para entender antes de proponer.</span>
                  </div>
                </section>
              )}
              {tab === "Vista general" && (
                <div className="bottom-grid">
                  <article className="card method-card">
                    <span className="mini-icon">
                      <Settings2 size={20} />
                    </span>
                    <div>
                      <h3>Tu forma de hacer discovery.</h3>
                      <p>Personaliza las preguntas y publica tu metodología.</p>
                      <button
                        className="text-link"
                        onClick={() => setTab("Constructor")}
                      >
                        Abrir constructor <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                  <article className="card method-card">
                    <span className="mini-icon green">
                      <Plug size={20} />
                    </span>
                    <div>
                      <h3>Preparado para conectar.</h3>
                      <p>
                        Explora cómo se integrarán investigación e inteligencia.
                      </p>
                      <button
                        className="text-link"
                        onClick={() => setTab("Integraciones")}
                      >
                        Ver integraciones <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                </div>
              )}
              {tab === "Constructor" && config && (
                <section className="card editor">
                  <div className="section-heading">
                    <div>
                      <h2>Diseña la conversación</h2>
                      <p>
                        Editar el borrador no cambia las sesiones iniciadas.
                      </p>
                    </div>
                    <span className="tag">
                      {tenant?.versions.length} versiones conservadas
                    </span>
                  </div>
                  <label>
                    Título
                    <input
                      value={config.title}
                      onChange={(e) =>
                        setConfig({ ...config, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Introducción
                    <textarea
                      value={config.description}
                      onChange={(e) =>
                        setConfig({ ...config, description: e.target.value })
                      }
                    />
                  </label>
                  <DiscoveryEditor config={config} onChange={setConfig} />
                  {!config.discovery?.enabled && (
                    <div className="question-editor">
                      {config.questions.map((q, i) => (
                        <div className="question-row" key={q.id}>
                          <span className="index">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="question-fields">
                            <input
                              aria-label={`Pregunta ${i + 1}`}
                              value={q.label}
                              onChange={(e) =>
                                updateQuestion(i, { label: e.target.value })
                              }
                            />
                            <div className="inline-fields">
                              <select
                                aria-label={`Tipo ${i + 1}`}
                                value={q.type}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    type: e.target.value as Question["type"],
                                  })
                                }
                              >
                                {[
                                  "text",
                                  "single",
                                  "multiple",
                                  "number",
                                  "url",
                                  "boolean",
                                ].map((t) => (
                                  <option key={t}>{t}</option>
                                ))}
                              </select>
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={q.required}
                                  onChange={(e) =>
                                    updateQuestion(i, {
                                      required: e.target.checked,
                                    })
                                  }
                                />
                                Obligatoria
                              </label>
                              <button
                                className="text-link"
                                disabled={i === 0}
                                onClick={() => {
                                  const questions = [...config.questions];
                                  [questions[i - 1], questions[i]] = [
                                    questions[i],
                                    questions[i - 1],
                                  ];
                                  setConfig({ ...config, questions });
                                }}
                              >
                                Subir
                              </button>
                              <button
                                className="text-link danger"
                                onClick={() =>
                                  setConfig({
                                    ...config,
                                    questions: config.questions.filter(
                                      (_, index) => index !== i,
                                    ),
                                  })
                                }
                              >
                                Eliminar
                              </button>
                            </div>
                            {["single", "multiple"].includes(q.type) && (
                              <input
                                aria-label="Opciones separadas por coma"
                                placeholder="Opciones separadas por coma"
                                value={q.options?.join(", ") || ""}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    options: e.target.value
                                      .split(",")
                                      .map((s) => s.trim()),
                                  })
                                }
                              />
                            )}
                            <div className="inline-fields">
                              <select
                                aria-label={`Condición ${i + 1}`}
                                value={q.visibleIf?.questionId || ""}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    visibleIf: e.target.value
                                      ? {
                                          questionId: e.target.value,
                                          value: true,
                                        }
                                      : undefined,
                                  })
                                }
                              >
                                <option value="">Siempre visible</option>
                                {config.questions
                                  .slice(0, i)
                                  .filter(
                                    (x) =>
                                      x.type === "boolean" ||
                                      x.type === "single",
                                  )
                                  .map((x) => (
                                    <option value={x.id} key={x.id}>
                                      {x.label}
                                    </option>
                                  ))}
                              </select>
                              {q.visibleIf && (
                                <input
                                  aria-label="Valor de condición"
                                  value={String(q.visibleIf.value)}
                                  onChange={(e) =>
                                    updateQuestion(i, {
                                      visibleIf: {
                                        questionId: q.visibleIf!.questionId,
                                        value:
                                          e.target.value === "true"
                                            ? true
                                            : e.target.value === "false"
                                              ? false
                                              : e.target.value,
                                      },
                                    })
                                  }
                                />
                              )}
                            </div>
                            <small className="muted">ID estable: {q.id}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="editor-actions">
                    {!config.discovery?.enabled && (
                      <button
                        className="button secondary"
                        onClick={() =>
                          setConfig({
                            ...config,
                            questions: [
                              ...config.questions,
                              {
                                id: "q_" + Date.now(),
                                label: "Nueva pregunta",
                                type: "text",
                                required: false,
                              },
                            ],
                          })
                        }
                      >
                        Añadir pregunta <Plus size={16} />
                      </button>
                    )}
                    <button
                      disabled={busy}
                      className="button secondary"
                      onClick={() =>
                        action(
                          () => api("admin/template", "PUT", config),
                          "Borrador guardado",
                        )
                      }
                    >
                      Guardar borrador
                    </button>
                    <button
                      disabled={busy}
                      className="button primary"
                      onClick={() =>
                        action(async () => {
                          await api("admin/template", "PUT", config);
                          await api("admin/publish", "POST");
                        }, "Nueva versión publicada")
                      }
                    >
                      Guardar y publicar <ArrowUpRight size={16} />
                    </button>
                  </div>
                </section>
              )}
              {tab === "Integraciones" && (
                <>
                  <AiConnectionPanel key={tenant?.id} />
                  <div className="notice">
                    La IA conversacional puede conectarse a OpenAI. La
                    investigación web y Supabase continúan simulados. Las
                    sesiones predefinidas conservan su informe de demostración.
                  </div>
                  <div className="integration-grid">
                    {[
                      {
                        name: "Firecrawl",
                        category: "COMPANY INTELLIGENCE",
                        text: "Extracción e investigación acotada del sitio web.",
                        letter: "F",
                      },
                      {
                        name: "Supabase",
                        category: "DATOS & IDENTIDAD",
                        text: "Destino previsto para Auth, PostgreSQL y cola persistente.",
                        letter: "S",
                      },
                    ].map((p) => (
                      <article className="card integration" key={p.name}>
                        <span className="integration-logo">{p.letter}</span>
                        <span className="tag">Simulado</span>
                        <div className="eyebrow">{p.category}</div>
                        <h2>{p.name}</h2>
                        <p>{p.text}</p>
                        <div className="integration-state">
                          <span className="live-dot" /> Adaptador local de
                          demostración
                        </div>
                      </article>
                    ))}
                  </div>
                  <section className="card guide">
                    <h2>Qué puedes probar hoy</h2>
                    <p>
                      Crea una sesión, responde el cuestionario, revisa el
                      avance del trabajo y abre el informe. En las sesiones
                      predefinidas puedes simular un timeout recuperable o una
                      indisponibilidad persistente y reintentar desde este
                      panel.
                    </p>
                    <p>
                      La persistencia actual es SQLite local y el acceso
                      administrativo es de demostración. Las membresías y las
                      políticas RLS se implementarán en la siguiente fase. La
                      conexión de IA se activa por empresa desde este panel.
                    </p>
                  </section>
                </>
              )}
              {tab === "Configuración" && tenant && (
                <form
                  className="card editor"
                  key={tenant.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(
                      () =>
                        api("admin/brand", "PUT", {
                          name: f.get("name"),
                          color: f.get("color"),
                          cta: f.get("cta"),
                          services: [
                            f.get("s0") || tenant.services[0],
                            f.get("s1") || tenant.services[1],
                            f.get("s2") || tenant.services[2],
                          ],
                        }),
                      "Identidad actualizada",
                    );
                  }}
                >
                  <h2>Una experiencia con tu identidad</h2>
                  <label>
                    Nombre de la empresa
                    <input name="name" defaultValue={tenant.name} required />
                  </label>
                  <label>
                    Color de marca
                    <input
                      name="color"
                      type="color"
                      defaultValue={tenant.color}
                    />
                  </label>
                  <label>
                    Siguiente paso del informe
                    <input name="cta" defaultValue={tenant.cta} required />
                  </label>
                  <h3>Catálogo de servicios</h3>
                  {tenant.draft.discovery?.enabled ? (
                    <p className="muted small">
                      Configura los servicios y sus criterios de interés en{" "}
                      <button
                        className="text-link"
                        type="button"
                        onClick={() => setTab("Constructor")}
                      >
                        Constructor
                      </button>
                      .
                    </p>
                  ) : (
                    tenant.services.map((s, i) => (
                      <label key={i}>
                        Servicio {i + 1}
                        <input name={"s" + i} defaultValue={s} required />
                      </label>
                    ))
                  )}
                  <button disabled={busy} className="button primary">
                    Guardar identidad
                  </button>
                  <p className="muted small">
                    Enlace público:{" "}
                    <a href={`/s/${tenant.slug}`} target="_blank">
                      /s/{tenant.slug} <ExternalLink size={12} />
                    </a>
                  </p>
                </form>
              )}
            </>
          )}
          <footer className="footer">
            <span className="wordmark small-wordmark">
              discovery<span className="os">OS</span>
            </span>
            <span>BUILT FOR BETTER CONVERSATIONS.</span>
            <span>MVP / v0.3</span>
          </footer>
        </main>
      </div>
      {login && (
        <div className="modal-backdrop">
          <form
            className="login-card"
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                () =>
                  api(creatingAccess ? "signup" : "login", "POST", {
                    tenantId,
                    password,
                    email,
                  }),
                creatingAccess
                  ? "Acceso solicitado. Confirma tu correo y vuelve a iniciar sesión."
                  : "Workspace abierto",
              );
            }}
          >
            <span className="logo">
              <AudioLines size={25} />
            </span>
            <div className="eyebrow">BIENVENIDA A DISCOVERY OS</div>
            <h2>
              Tu próxima oportunidad
              <br />
              empieza aquí.
            </h2>
            <p>
              {cloud
                ? "Accede con tu usuario de Supabase y una empresa autorizada."
                : "Acceso local de demostración. Usa únicamente datos sintéticos."}
            </p>
            <label>
              Empresa
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              >
                <option value="mood">Mood Agency</option>
                <option value="norte">Norte Industrial</option>
                <option value="dental">Clínica Sonrisa · ejemplo dental</option>
              </select>
            </label>
            <label>
              {cloud ? "Contraseña" : "Contraseña de demostración"}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {cloud && (
              <label>
                Correo de acceso
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {!cloud && (
              <small className="muted">Predeterminada: discovery-demo</small>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary" disabled={busy}>
              {creatingAccess ? "Crear mi acceso" : "Entrar al workspace"}{" "}
              <ArrowRight size={16} />
            </button>
            {cloud && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setCreatingAccess(!creatingAccess);
                  setError("");
                  setMessage("");
                }}
              >
                {creatingAccess
                  ? "Ya tengo cuenta · iniciar sesión"
                  : "Primer acceso · crear mi cuenta"}
              </button>
            )}
            {message && <p role="status">{message}</p>}
            {data && (
              <button
                type="button"
                className="text-link"
                onClick={() => setLogin(false)}
              >
                Cancelar
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
