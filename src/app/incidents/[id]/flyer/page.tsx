import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getIncident(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("incidents")
    .select("id,incident_number,title,type,status,short_description,staging_name,staging_address,staging_lat,staging_lng,created_at")
    .eq("id", id)
    .single();
  return data;
}

export default async function FlyerPage({ params }: { params: { id: string } }) {
  const incident = await getIncident(params.id);
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
          }
          .page { max-width: 760px; margin: 0 auto; padding: 32px 24px; }
          .header { background: #c00; color: #fff; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; }
          .header h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
          .header p { font-size: 13px; opacity: 0.85; margin-top: 4px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 10px; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
          .incident-title { font-size: 24px; font-weight: 800; margin: 0 0 16px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          @media (max-width: 500px) { .grid { grid-template-columns: 1fr; } }
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
          .footer { border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: gap; }
          .footer-logo { font-size: 16px; font-weight: 900; color: #c00; letter-spacing: -0.5px; }
          .footer-meta { font-size: 12px; color: #999; text-align: right; }
          .print-btn { display: inline-flex; align-items: center; gap: 8px; background: #c00; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
          .print-btn:hover { background: #a00; }
        `}</style>
      </head>
      <body>
        <div className="page">
          <button className="print-btn no-print">🖨 Print / Save PDF</button>

          <div className="header">
            <div className="badge">MISSING PERSON</div>
            <h1>{incident.title}</h1>
            <p>{incident.type} &nbsp;·&nbsp; {incident.incident_number} &nbsp;·&nbsp; {incident.status}</p>
          </div>

          <div className="grid">
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
