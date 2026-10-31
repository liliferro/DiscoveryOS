"use client";
import type { Config } from "@/lib/domain";
import { defaultDiscovery, type DiscoveryConfig } from "@/lib/discovery";
export default function DiscoveryEditor({
  config,
  onChange,
}: {
  config: Config;
  onChange: (config: Config) => void;
}) {
  const d = config.discovery || defaultDiscovery;
  const update = (patch: Partial<DiscoveryConfig>) =>
    onChange({ ...config, discovery: { ...structuredClone(d), ...patch } });
  return (
    <section className="discovery-editor">
      <div className="mode-switch">
        <div>
          <h3>Conversación dirigida por IA</h3>
          <p>La IA decide qué preguntar según el objetivo y cada respuesta.</p>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={d.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          Activar
        </label>
      </div>
      {d.enabled && (
        <>
          <label>
            Enlace para agendar una valoración
            <input
              type="url"
              value={config.bookingUrl || ""}
              onChange={(e) =>
                onChange({ ...config, bookingUrl: e.target.value })
              }
              placeholder="https://wa.me/525523153249"
            />
            <small>
              WhatsApp o agenda de la empresa. Se muestra al terminar; no envía
              mensajes automáticamente.
            </small>
          </label>
          <label>
            Objetivo del discovery
            <textarea
              value={d.objective}
              onChange={(e) => update({ objective: e.target.value })}
              placeholder="¿Qué debe comprender la conversación y para qué se utilizará?"
            />
          </label>
          <label>
            Contexto completo de la empresa
            <textarea
              className="context-input"
              value={d.context}
              onChange={(e) => update({ context: e.target.value })}
              placeholder="Cómo funciona la empresa, qué ofrece, diferencias entre servicios, disponibilidad confirmada y siguiente paso..."
            />
          </label>
          <label>
            ¿Con quién conversamos?
            <textarea
              value={d.audience}
              onChange={(e) => update({ audience: e.target.value })}
            />
          </label>
          <label>
            Tono de la conversación
            <input
              value={d.tone}
              onChange={(e) => update({ tone: e.target.value })}
            />
          </label>
          <label>
            Límites y temas que no debe abordar
            <textarea
              value={d.boundaries}
              onChange={(e) => update({ boundaries: e.target.value })}
            />
          </label>
          <div className="limits-grid">
            <label>
              Mínimo de respuestas
              <input
                type="number"
                min={2}
                max={8}
                value={d.minTurns}
                onChange={(e) => update({ minTurns: Number(e.target.value) })}
              />
            </label>
            <label>
              Máximo de respuestas
              <input
                type="number"
                min={4}
                max={12}
                value={d.maxTurns}
                onChange={(e) => update({ maxTurns: Number(e.target.value) })}
              />
            </label>
          </div>
          <h3>Servicios y señales de interés</h3>
          <p className="muted small">
            Explica cada servicio para que la IA pueda diferenciarlos. Puede
            detectar interés en varios o en ninguno.
          </p>
          {d.services.map((s, i) => (
            <div className="editor-subcard" key={i}>
              <label>
                Nombre del servicio
                <input
                  value={s.name}
                  onChange={(e) =>
                    update({
                      services: d.services.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Qué ofrece y qué interés ayuda a explorar
                <textarea
                  value={s.description}
                  onChange={(e) =>
                    update({
                      services: d.services.map((x, j) =>
                        j === i ? { ...x, description: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <button
                className="text-link danger"
                onClick={() =>
                  update({ services: d.services.filter((_, j) => j !== i) })
                }
              >
                Eliminar servicio
              </button>
            </div>
          ))}
          <button
            className="button secondary"
            onClick={() =>
              update({
                services: [
                  ...d.services,
                  {
                    name: "Nuevo servicio",
                    description: "Describe el servicio y sus diferencias.",
                  },
                ],
              })
            }
          >
            Añadir servicio
          </button>
          <h3>Información que queremos comprender</h3>
          <p className="muted small">
            Estos son objetivos de información, no preguntas fijas. La IA decide
            cómo y cuándo explorarlos. No pidas información sensible
            innecesaria.
          </p>
          {d.fields.map((f, i) => (
            <div className="editor-subcard" key={f.id}>
              <label>
                Campo del perfil
                <input
                  value={f.label}
                  onChange={(e) =>
                    update({
                      fields: d.fields.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Qué queremos comprender
                <textarea
                  value={f.description}
                  onChange={(e) =>
                    update({
                      fields: d.fields.map((x, j) =>
                        j === i ? { ...x, description: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <div className="inline-fields">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) =>
                      update({
                        fields: d.fields.map((x, j) =>
                          j === i ? { ...x, required: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  Explorar antes de cerrar
                </label>
                <button
                  className="text-link danger"
                  onClick={() =>
                    update({ fields: d.fields.filter((_, j) => j !== i) })
                  }
                >
                  Eliminar campo
                </button>
              </div>
              <small className="muted">ID: {f.id}</small>
            </div>
          ))}
          <button
            className="button secondary"
            onClick={() =>
              update({
                fields: [
                  ...d.fields,
                  {
                    id: "field_" + Date.now(),
                    label: "Nuevo campo",
                    description:
                      "Describe qué necesitas comprender del visitante.",
                    required: false,
                  },
                ],
              })
            }
          >
            Añadir campo de perfil
          </button>
          <div className="notice">
            Guarda y publica para aplicar estos cambios a las nuevas sesiones.
            El contexto interno no se envía al navegador del visitante.
          </div>
        </>
      )}
    </section>
  );
}
