import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

function fmt(dt: string | null) {
  if (!dt) return "";
  return new Date(dt).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [{ data: incident }, { data: rawSubjects }] = await Promise.all([
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

  if (!incident) {
    return new NextResponse("Incident not found", { status: 404 });
  }

  const subjects = (rawSubjects ?? []) as Subject[];

  const created = new Date(incident.created_at).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const mapsUrl = incident.staging_lat && incident.staging_lng
    ? `https://maps.google.com/?q=${incident.staging_lat},${incident.staging_lng}`
    : incident.staging_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(incident.staging_address)}`
      : null;

  const subjectsHtml = subjects.map((s, i) => `
    <div class="subject-section${i > 0 ? " page-break" : ""}">
      <div class="subject-header">
        ${s.photo_url
          ? `<img src="${esc(s.photo_url)}" alt="${esc(s.full_name)}" class="subject-photo" />`
          : `<div class="subject-photo-placeholder">👤</div>`
        }
        <div style="flex:1;min-width:0">
          <div class="subject-name">${esc(s.full_name) || "Unknown"}</div>
          ${s.also_known_as ? `<div class="subject-aka">AKA: ${esc(s.also_known_as)}</div>` : ""}
          <div class="subject-meta">
            ${s.gender ? `<span class="subject-tag">${esc(s.gender)}</span>` : ""}
            ${s.date_of_birth ? `<span class="subject-tag">DOB: ${esc(s.date_of_birth)}</span>` : ""}
            ${s.age_estimate ? `<span class="subject-tag">Age: ~${esc(s.age_estimate)}</span>` : ""}
            ${s.nationality ? `<span class="subject-tag">${esc(s.nationality)}</span>` : ""}
            ${s.height_cm ? `<span class="subject-tag">${s.height_cm} cm</span>` : ""}
            ${s.weight_kg ? `<span class="subject-tag">${s.weight_kg} kg</span>` : ""}
          </div>
          <div style="font-size:13px;color:#555;line-height:1.7">
            ${[
              s.hair_color ? `Hair: ${s.hair_color}${s.hair_length ? ` (${s.hair_length})` : ""}` : null,
              s.eye_color ? `Eyes: ${s.eye_color}` : null,
              s.build ? `Build: ${s.build}` : null,
              s.skin_tone ? `Skin: ${s.skin_tone}` : null,
            ].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>
      ${s.distinguishing_features ? `
        <div class="info-box">
          <div class="box-label">Distinguishing Features / Marks / Tattoos</div>
          <p>${esc(s.distinguishing_features)}</p>
        </div>` : ""}
      ${(s.last_seen_wearing || s.last_seen_location || s.last_seen_at) ? `
        <div class="last-seen-box">
          <div class="box-label red">⚠ Last Known Information</div>
          ${s.last_seen_wearing ? `<div style="margin-bottom:6px"><span class="mini-label">Wearing: </span>${esc(s.last_seen_wearing)}</div>` : ""}
          ${s.last_seen_location ? `<div style="margin-bottom:6px"><span class="mini-label">Location: </span>${esc(s.last_seen_location)}</div>` : ""}
          ${s.last_seen_at ? `<div><span class="mini-label">Last Seen: </span><strong style="color:#c00">${fmt(s.last_seen_at)}</strong></div>` : ""}
        </div>` : ""}
      ${s.medical_conditions ? `
        <div class="medical-box">
          <div class="box-label amber">⚕ Medical / Health Information</div>
          <p>${esc(s.medical_conditions)}</p>
        </div>` : ""}
      ${s.notes ? `<p style="font-size:13px;color:#777;font-style:italic;margin-bottom:12px">${esc(s.notes)}</p>` : ""}
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Missing Person — ${esc(incident.title)}</title>
  <style>
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
    .info-box { border: 1.5px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
    .info-box p { font-size: 14px; line-height: 1.6; color: #333; white-space: pre-wrap; margin-top: 6px; }
    .staging-box { background: #fff8f0; border: 1.5px solid #f4a630; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
    .staging-box a { color: #c47a00; font-weight: 600; text-decoration: none; }
    .qr-hint { font-size: 12px; color: #888; margin-top: 4px; }
    .footer { border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .footer-logo { font-size: 16px; font-weight: 900; color: #c00; letter-spacing: -0.5px; }
    .footer-meta { font-size: 12px; color: #999; text-align: right; }
    .print-btn { display: inline-flex; align-items: center; gap: 8px; background: #c00; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
    .print-btn:hover { background: #a00; }
    .subject-section { margin-bottom: 28px; }
    .subject-header { display: flex; align-items: flex-start; gap: 20px; background: #f9f9f9; border: 1.5px solid #e5e5e5; border-radius: 10px; padding: 18px; margin-bottom: 16px; }
    .subject-photo { width: 120px; height: 150px; object-fit: cover; border-radius: 8px; border: 1.5px solid #ddd; flex-shrink: 0; }
    .subject-photo-placeholder { width: 120px; height: 150px; background: #eee; border-radius: 8px; border: 1.5px solid #ddd; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 48px; color: #ccc; }
    .subject-name { font-size: 24px; font-weight: 900; color: #111; margin-bottom: 2px; }
    .subject-aka { font-size: 13px; color: #666; margin-bottom: 10px; }
    .subject-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .subject-tag { background: #f0f0f0; border-radius: 4px; padding: 3px 10px; font-size: 12px; font-weight: 600; color: #444; }
    .last-seen-box { background: #fff5f5; border: 1.5px solid #f5c6cb; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; font-size: 14px; color: #222; }
    .medical-box { background: #fffbe6; border: 1.5px solid #ffe082; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; font-size: 14px; color: #333; }
    .box-label { font-size: 10px; font-weight: 700; letter-spacing: 1.2px; color: #999; text-transform: uppercase; margin-bottom: 8px; }
    .box-label.red { color: #c00; }
    .box-label.amber { color: #b45309; }
    .mini-label { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #999; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  </style>
</head>
<body>
  <div class="page">
    <button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>

    <div class="header">
      <div class="badge">MISSING PERSON</div>
      <h1>${esc(incident.title)}</h1>
      <p>${esc(incident.type)} &nbsp;·&nbsp; ${esc(incident.incident_number)} &nbsp;·&nbsp; ${esc(incident.status)}</p>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="card-label">Incident #</div>
        <div class="card-value mono">${esc(incident.incident_number)}</div>
      </div>
      <div class="card">
        <div class="card-label">Reported</div>
        <div class="card-value" style="font-size:14px">${esc(created)}</div>
      </div>
      <div class="card">
        <div class="card-label">Type</div>
        <div class="card-value">${esc(incident.type)}</div>
      </div>
      <div class="card">
        <div class="card-label">Status</div>
        <div class="card-value" style="color:${incident.status === "Active" ? "#c00" : "#555"}">${esc(incident.status)}</div>
      </div>
    </div>

    ${incident.short_description ? `
    <div class="info-box" style="margin-bottom:20px">
      <div class="card-label">Description / Last Known Info</div>
      <p>${esc(incident.short_description)}</p>
    </div>` : ""}

    ${subjects.length > 0 ? `
    <div class="section-title">Missing Person${subjects.length > 1 ? "s" : ""}</div>
    ${subjectsHtml}` : ""}

    ${(incident.staging_name || incident.staging_address) ? `
    <div class="staging-box">
      <div class="card-label" style="color:#c47a00">Staging / Command Post</div>
      ${incident.staging_name ? `<div class="card-value" style="margin-bottom:4px">${esc(incident.staging_name)}</div>` : ""}
      ${incident.staging_address ? `<div style="font-size:14px;color:#555;margin-bottom:6px">${esc(incident.staging_address)}</div>` : ""}
      ${mapsUrl ? `<a href="${esc(mapsUrl)}" target="_blank">Open in Google Maps ↗</a>` : ""}
      ${(incident.staging_lat && incident.staging_lng) ? `<div class="qr-hint">${incident.staging_lat.toFixed(5)}, ${incident.staging_lng.toFixed(5)}</div>` : ""}
    </div>` : ""}

    <div class="footer">
      <div class="footer-logo">MATZIL SAR</div>
      <div class="footer-meta">
        <div>Printed ${new Date().toLocaleDateString("en-US")}</div>
        <div>For official SAR use only</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
