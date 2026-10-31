import type { Run } from "@/lib/domain";
export default function LeadContactCard({
  contact,
}: {
  contact: NonNullable<Run["contact"]>;
}) {
  return (
    <section className="card lead-contact-details">
      <h3>Datos del prospecto</h3>
      <dl>
        <dt>Nombre</dt>
        <dd>{contact.name}</dd>
        <dt>WhatsApp</dt>
        <dd>
          <a
            href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {contact.whatsapp}
          </a>
        </dd>
        <dt>Correo</dt>
        <dd>
          <a href={`mailto:${encodeURIComponent(contact.email)}`}>
            {contact.email}
          </a>
        </dd>
      </dl>
      <small>
        Autorizó el contacto el{" "}
        {new Date(contact.consentedAt).toLocaleString("es-MX")}.
      </small>
    </section>
  );
}
