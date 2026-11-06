"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { toothNumbers, type DentalMapValue } from "@/lib/dental-map";

export default function DentalMap({
  value,
  onChange,
  onContinue,
  onBack,
}: {
  value: DentalMapValue;
  onChange: (value: DentalMapValue) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [tool, setTool] = useState<"missing" | "concern" | "clear">("missing");
  const [focusedTooth, setFocusedTooth] = useState<number>(11);
  const update = (number: number) => {
    const existing = value.teeth.find((t) => t.number === number);
    onChange({
      skipped: false,
      teeth: [
        ...value.teeth.filter((t) => t.number !== number),
        ...(tool === "clear" || existing?.status === tool
          ? []
          : [{ number, status: tool }]),
      ],
    });
  };
  return (
    <section className="dental-map-screen">
      <span className="eyebrow">TU MAPA DENTAL · LO QUE TÚ NOS CUENTAS</span>
      <h1>¿Hay alguna pieza que te gustaría señalar?</h1>
      <p>
        Elige un marcador y toca las piezas. Si no sabes cuáles son, puedes
        contarlo después con tus palabras. Con teclado, usa las flechas para
        moverte y Enter para marcar.
      </p>
      <fieldset className="dental-tools">
        <legend>Qué quieres marcar</legend>
        {(
          [
            ["missing", "Pieza ausente"],
            ["concern", "Me preocupa"],
            ["clear", "Quitar marca"],
          ] as const
        ).map(([id, label]) => (
          <label key={id}>
            <input
              type="radio"
              name="tooth-tool"
              checked={tool === id}
              onChange={() => setTool(id)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div
        className="dental-arch"
        role="group"
        aria-label="Mapa de dentición permanente, numeración FDI"
      >
        <span className="arch-label upper">SUPERIOR</span>
        <span className="arch-label lower">INFERIOR</span>
        <span className="arch-side right">Tu derecha</span>
        <span className="arch-side left">Tu izquierda</span>
        {toothNumbers.map((number, i) => {
          const lower = i >= 16;
          const angle = (Math.PI * (i % 16)) / 15;
          const x = 50 - 36 * Math.cos(angle);
          const y = lower
            ? 62 + 29 * Math.sin(angle)
            : 38 - 29 * Math.sin(angle);
          const status = value.teeth.find((t) => t.number === number)?.status;
          return (
            <button
              key={number}
              type="button"
              className={`map-tooth ${status || "unmarked"}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => update(number)}
              tabIndex={number === focusedTooth ? 0 : -1}
              onFocus={() => setFocusedTooth(number)}
              onKeyDown={(event) => {
                const offset = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -16,
                  ArrowDown: 16,
                }[event.key];
                if (offset === undefined) return;
                event.preventDefault();
                const next =
                  (i + offset + toothNumbers.length) % toothNumbers.length;
                const buttons =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    ".map-tooth",
                  );
                buttons?.[next]?.focus();
              }}
              aria-pressed={!!status}
              aria-label={`Pieza ${number}, ${status === "missing" ? "ausente" : status === "concern" ? "me preocupa" : "sin marcar"}`}
            >
              <span>{number}</span>
              {status && (
                <small aria-hidden="true">
                  {status === "missing" ? "−" : "!"}
                </small>
              )}
            </button>
          );
        })}
        <div className="arch-center" aria-hidden="true">
          TU SONRISA
          <br />
          <small>Vista de frente</small>
        </div>
      </div>
      <div className="dental-map-meta">
        <span role="status">
          {value.teeth.length}{" "}
          {value.teeth.length === 1 ? "pieza marcada" : "piezas marcadas"}
        </span>
        <button
          type="button"
          className="text-link"
          onClick={() => onChange({ skipped: false, teeth: [] })}
        >
          <RotateCcw size={14} /> Limpiar mapa
        </button>
      </div>
      <label className="checkbox dental-skip">
        <input
          type="checkbox"
          checked={value.skipped}
          onChange={(e) => onChange({ skipped: e.target.checked, teeth: [] })}
        />
        No estoy seguro/a; prefiero contarlo en la conversación.
      </label>
      <p className="adaptive-note">
        No necesitas una radiografía. Este mapa refleja tu percepción y no
        permite determinar un tratamiento. Incluye dentición permanente; si tu
        caso es diferente, puedes explicarlo durante la conversación.
      </p>
      <div className="question-actions">
        <button className="text-link" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Tus datos
        </button>
        <button className="button primary" type="button" onClick={onContinue}>
          {value.skipped
            ? "Continuar sin mapa"
            : value.teeth.length
              ? "Guardar mapa y continuar"
              : "Continuar sin piezas marcadas"}
          <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}
