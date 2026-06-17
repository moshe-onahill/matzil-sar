import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Subject = {
  id: string;
  full_name: string | null;
  also_known_as: string | null;
  date_of_birth: string | null;
  age_estimate: string | null;
  gender: string | null;
  nationality: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  hair_color: string | null;
  hair_length: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  build: string | null;
  distinguishing_features: string | null;
  last_seen_wearing: string | null;
  last_seen_location: string | null;
  last_seen_at: string | null;
  medical_conditions: string | null;
  photo_url: string | null;
  notes: string | null;
};

async function getData(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [{ data: incident }, { data: subjects }] = await Promise.all([
    supabase
      .from("incidents")
      .select("id,incident_number,title,type,status,short_description,staging_name,staging_address,staging_lat,staging_lng,created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("incident_subjects")
      .select("*")
      .eq("incident_id", id)
      .order("created_at"),
  ]);
  return { incident, subjects: (subjects ?? []) as Subject[] };
}

function fmt(dt: string | null) {
  if (!dt) return null;
  return new Date(dt).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function FlyerPage({ params }: { params: { id: string } }) {
  const { incident, subjects } = await getData(params.id);
  if (!incident) return notFound();

  const created = new Date(incident.created_at).toLocaleString([], {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const mapsUrl = incident.staging_lat && incident.staging_lng
    ? `https://maps.google.com/?q=${incident.staging_lat},${incident.staging_lng}`
    : incident.staging_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(incident.staging_address)}`
      : null;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Missing Person — {incident.title}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111; }
          @media print {
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page-break { page-break-before: always; }
          }
          .page { max-width: 780px; margin: 0 auto; padding: 32px 24px; }
          .header { background: #c00; color: #fff; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; }
          .header h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
          .header p { font-size: 13px; opacity: 0.85; margin-top: 4px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 10px; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          @media (max-width: 500px) { .grid2 { grid-template-columns: 1fr; } }
          .card { border: 1.5px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; }
          .card-label { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; color: #999; text-transform: uppercase; margin-bottom: 6px; }
          .card-value { font-size: 16px; font-weight: 600; color: #111; }
          .card-value.mono { font-family: monospace; }
          .description-box { border: 1.5px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
          .description-box .card-label { margin-bottom: 8px; }
          .description-box p { font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap; }
          .staging-box { background: #fff8f0; border: 1.5px solid #f4a630; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
          .staging-box .card-label { color: #c47a00; }
          .staging-box a { color: #c47a00; font-weight: 600; text-decoration: none; }
          .qr-hint { font-size: 12px; color: #888; margin-top: 4px; }
          .footer { border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
          .footer-logo { font-size: 16px; font-weight: 900; color: #c00; letter-spacing: -0.5px; }
          .footer-meta { font-size: 12px; color: #999; text-align: right; }
          .print-btn { display: inline-flex; align-items: center; gap: 8px; background: #c00; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
          .print-btn:hover { background: #a00; }

          /* Subject card */
          .subject-section { margin-bottom: 28px; }
          .subject-header { display: flex; align-items: flex-start; gap: 20px; background: #f9f9f9; border: 1.5px solid #e5e5e5; border-radius: 10px; padding: 18px; margin-bottom: 16px; }
          .subject-photo { width: 120px; height: 150px; object-fit: cover; border-radius: 8px; border: 1.5px solid #ddd; flex-shrink: 0; }
          .subject-photo-placeholder { width: 120px; height: 150px; background: #eee; border-radius: 8px; border: 1.5px solid #ddd; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 48px; color: #ccc; }
          .subject-name { font-size: 24px; font-weight: 900; color: #111; margin-bottom: 2px; }
          .subject-aka { font-size: 13px; color: #666; margin-bottom: 10px; }
          .subject-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
          .subject-tag { background: #f0f0f0; border-radius: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; color: #444; }
          .subject-tag.warn { background: #fff3cd; color: #856404; }
          .physical-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          @media (max-width: 500px) { .physical-grid { grid-template-columns: 1fr 1fr; } }
          .phys-item { border: 1px solid #eee; border-radius: 6px; padding: 8px 10px; }
          .phys-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #aaa; text-transform: uppercase; }
          .phys-value { font-size: 14px; font-weight: 600; color: #222; margin-top: 2px; }
          .last-seen-box { background: #fff5f5; border: 1.5px solid #f5c6cb; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
          .last-seen-box .card-label { color: #c00; }
          .medical-box { background: #fffbe6; border: 1.5px solid #ffe082; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
          .medical-box .card-label { color: #b45309; }
          .section-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #999; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
        `}</style>
      </head>
      <body>
        <div className="page">
          <button className="print-btn no-print">🖨 Print / Save PDF</button>

          {/* Incident header */}
          <div className="header">
            <div className="badge">MISSING PERSON</div>
            <h1>{incident.title}</h1>
            <p>{incident.type} &nbsp;·&nbsp; {incident.incident_number} &nbsp;·&nbsp; {incident.status}</p>
          </div>

          {/* Incident meta */}
          <div className="grid2">
            <div className="card">
              <div className="card-label">Incident #</div>
              <div className="card-value mono">{incident.incident_number}</div>
            </div>
            <div className="card">
              <div className="card-label">Reported</div>
              <div className="card-value" style={{ fontSize: 14 }}>{created}</div>
            </div>
            <div className="card">
              <div className="card-label">Type</div>
              <div className="card-value">{incident.type}</div>
            </div>
            <div className="card">
              <div className="card-label">Status</div>
              <div className="card-value" style={{ color: incident.status === "Active" ? "#c00" : "#555" }}>{incident.status}</div>
            </div>
          </div>

          {incident.short_description && (
            <div className="description-box">
              <div className="card-label">Description / Last Known Info</div>
              <p>{incident.short_description}</p>
            </div>
          )}

          {/* Subjects */}
          {subjects.length > 0 && (
            <>
              <div className="section-title">Missing Person{subjects.length > 1 ? "s" : ""}</div>
              {subjects.map((s, i) => (
                <div key={s.id} className={`subject-section${i > 0 ? " page-break" : ""}`}>
                  {/* Photo + identity */}
                  <div className="subject-header">
                    {s.photo_url
                      ? <img src={s.photo_url} alt={s.full_name ?? "Subject"} className="subject-photo" />
                      : <div className="subject-photo-placeholder">👤</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="subject-name">{s.full_name ?? "Unknown"}</div>
                      {s.also_known_as && <div className="subject-aka">AKA: {s.also_known_as}</div>}
                      <div className="subject-meta">
                        {s.gender && <span className="subject-tag">{s.gender}</span>}
                        {s.date_of_birth && <span className="subject-tag">DOB: {s.date_of_birth}</span>}
                        {s.age_estimate && <span className="subject-tag">Age: ~{s.age_estimate}</span>}
                        {s.nationality && <span className="subject-tag">{s.nationality}</span>}
                        {s.height_cm && <span className="subject-tag">{s.height_cm} cm</span>}
                        {s.weight_kg && <span className="subject-tag">{s.weight_kg} kg</span>}
                      </div>
                      {s.hair_color || s.eye_color || s.build || s.skin_tone ? (
                        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
                          {[
                            s.hair_color ? `Hair: ${s.hair_color}${s.hair_length ? ` (${s.hair_length})` : ""}` : null,
                            s.eye_color ? `Eyes: ${s.eye_color}` : null,
                            s.build ? `Build: ${s.build}` : null,
                            s.skin_tone ? `Skin: ${s.skin_tone}` : null,
                          ].filter(Boolean).join("  ·  ")}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Physical details */}
                  {s.distinguishing_features && (
                    <div className="description-box" style={{ marginBottom: 12 }}>
                      <div className="card-label">Distinguishing Features / Marks / Tattoos</div>
                      <p style={{ fontSize: 14 }}>{s.distinguishing_features}</p>
                    </div>
                  )}

                  {/* Last seen */}
                  {(s.last_seen_wearing || s.last_seen_location || s.last_seen_at) && (
                    <div className="last-seen-box">
                      <div className="card-label">⚠ Last Known Information</div>
                      {s.last_seen_wearing && (
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wearing: </span>
                          <span style={{ fontSize: 14, color: "#222" }}>{s.last_seen_wearing}</span>
                        </div>
                      )}
                      {s.last_seen_location && (
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>Location: </span>
                          <span style={{ fontSize: 14, color: "#222" }}>{s.last_seen_location}</span>
                        </div>
                      )}
                      {s.last_seen_at && (
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>Last Seen: </span>
                          <span style={{ fontSize: 14, color: "#c00", fontWeight: 600 }}>{fmt(s.last_seen_at)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Medical */}
                  {s.medical_conditions && (
                    <div className="medical-box">
                      <div className="card-label">⚕ Medical / Health Information</div>
                      <p style={{ fontSize: 14, color: "#333" }}>{s.medical_conditions}</p>
                    </div>
                  )}

                  {s.notes && (
                    <div className="description-box" style={{ marginBottom: 12 }}>
                      <div className="card-label">Notes</div>
                      <p style={{ fontSize: 13, color: "#555" }}>{s.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Staging / Command Post */}
          {(incident.staging_name || incident.staging_address) && (
            <div className="staging-box">
              <div className="card-label">Staging / Command Post</div>
              {incident.staging_name && <div className="card-value" style={{ marginBottom: 4 }}>{incident.staging_name}</div>}
              {incident.staging_address && <div style={{ fontSize: 14, color: "#555", marginBottom: 6 }}>{incident.staging_address}</div>}
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>}
              {incident.staging_lat && incident.staging_lng && (
                <div className="qr-hint">{incident.staging_lat.toFixed(5)}, {incident.staging_lng.toFixed(5)}</div>
              )}
            </div>
          )}

          <div className="footer">
            <div className="footer-logo">MATZIL SAR</div>
            <div className="footer-meta">
              <div>Printed {new Date().toLocaleDateString()}</div>
              <div>For official SAR use only</div>
            </div>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          document.querySelector('.print-btn')?.addEventListener('click', () => window.print());
        `}} />
      </body>
    </html>
  );
}
