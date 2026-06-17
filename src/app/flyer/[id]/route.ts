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

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(dt: string | null) {
  if (!dt) return "";
  return new Date(dt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function row(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `<tr><td class="dl">${label}</td><td class="dv">${esc(value)}</td></tr>`;
}

function subjectPage(s: Subject, origin: string) {
  const physRows = [
    row("Gender", s.gender),
    row("Date of Birth", s.date_of_birth),
    row("Age", s.age_estimate),
    row("Nationality", s.nationality),
    row("Height", s.height_cm ? `${s.height_cm} cm` : null),
    row("Weight", s.weight_kg ? `${s.weight_kg} kg` : null),
    row("Hair", s.hair_color ? `${s.hair_color}${s.hair_length ? `, ${s.hair_length}` : ""}` : null),
    row("Eyes", s.eye_color),
    row("Build", s.build),
    row("Skin", s.skin_tone),
  ].join("");

  return `
  <div class="poster">
    <!-- Header bar -->
    <div class="top-bar">
      <img src="${origin}/matzil-words.avif" class="logo-words" alt="Matzil SAR" />
      <div class="missing-label">MISSING PERSON</div>
    </div>

    <!-- Name -->
    <div class="name-block">
      <div class="name">${esc(s.full_name) || "UNKNOWN"}</div>
      ${s.also_known_as ? `<div class="aka">Also known as: ${esc(s.also_known_as)}</div>` : ""}
    </div>

    <!-- Photo + description columns -->
    <div class="body-cols">
      <div class="photo-col">
        ${s.photo_url
          ? `<img src="${esc(s.photo_url)}" class="subject-photo" alt="${esc(s.full_name)}" />`
          : `<div class="photo-placeholder"><span>NO PHOTO<br>AVAILABLE</span></div>`
        }
        ${(s.last_seen_at) ? `
        <div class="last-seen-stamp">
          <div class="ls-label">LAST SEEN</div>
          <div class="ls-date">${fmtDate(s.last_seen_at)}</div>
        </div>` : ""}
      </div>

      <div class="info-col">
        ${physRows ? `
        <div class="section-head">Physical Description</div>
        <table class="dl-table">${physRows}</table>` : ""}

        ${s.last_seen_location ? `
        <div class="section-head" style="margin-top:14px">Last Known Location</div>
        <div class="detail-text">${esc(s.last_seen_location)}</div>` : ""}

        ${s.last_seen_wearing ? `
        <div class="section-head" style="margin-top:14px">Last Seen Wearing</div>
        <div class="detail-text">${esc(s.last_seen_wearing)}</div>` : ""}

        ${s.distinguishing_features ? `
        <div class="section-head" style="margin-top:14px">Distinguishing Features</div>
        <div class="detail-text">${esc(s.distinguishing_features)}</div>` : ""}
      </div>
    </div>

    ${s.medical_conditions ? `
    <div class="alert-bar">
      <span class="alert-icon">⚕</span>
      <span><strong>Medical Alert:</strong> ${esc(s.medical_conditions)}</span>
    </div>` : ""}

    ${s.notes ? `<div class="notes-bar">${esc(s.notes)}</div>` : ""}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        <img src="${origin}/matzil-logo.avif" class="footer-emblem" alt="" />
        <div>
          <div class="footer-org">MATZIL SEARCH &amp; RESCUE</div>
          <div class="footer-sub">If you have information, contact emergency services immediately</div>
        </div>
      </div>
      <div class="footer-right">
        <div class="footer-date">Issued ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
        <div class="footer-ref">For official SAR use only</div>
      </div>
    </div>
  </div>`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = req.nextUrl.origin;

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

  const mapsUrl = incident.staging_lat && incident.staging_lng
    ? `https://maps.google.com/?q=${incident.staging_lat},${incident.staging_lng}`
    : incident.staging_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(incident.staging_address)}`
      : null;

  // If no subjects yet, show a placeholder page
  const postersHtml = subjects.length > 0
    ? subjects.map((s) => subjectPage(s, origin)).join('<div style="page-break-after:always"></div>')
    : `<div class="poster">
        <div class="top-bar">
          <img src="${origin}/matzil-words.avif" class="logo-words" alt="Matzil SAR" />
          <div class="missing-label">MISSING PERSON</div>
        </div>
        <div class="name-block">
          <div class="name">${esc(incident.title)}</div>
        </div>
        <div style="padding:40px 32px;text-align:center;color:#888;font-size:15px">
          No subject details entered yet.<br>
          Add a subject in the incident's <strong>Subject</strong> tab.
        </div>
        ${incident.short_description ? `
        <div style="margin:0 32px 24px;padding:16px 20px;background:#fff5f5;border:1.5px solid #f5c6cb;border-radius:8px;font-size:14px;color:#333">
          <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#c00;margin-bottom:6px">INCIDENT DETAILS</div>
          ${esc(incident.short_description)}
        </div>` : ""}
        <div class="footer">
          <div class="footer-left">
            <img src="${origin}/matzil-logo.avif" class="footer-emblem" alt="" />
            <div>
              <div class="footer-org">MATZIL SEARCH &amp; RESCUE</div>
              <div class="footer-sub">If you have information, contact emergency services immediately</div>
            </div>
          </div>
          <div class="footer-right">
            <div class="footer-ref">${esc(incident.incident_number)}</div>
          </div>
        </div>
      </div>`;

  // Staging info page (appended after subject posters)
  const stagingHtml = (incident.staging_name || incident.staging_address) ? `
    <div style="page-break-before:always"></div>
    <div class="poster" style="justify-content:flex-start">
      <div class="top-bar">
        <img src="${origin}/matzil-words.avif" class="logo-words" alt="Matzil SAR" />
        <div class="missing-label" style="background:#1a1a2e">${esc(incident.incident_number)}</div>
      </div>
      <div style="padding:32px;flex:1">
        <div class="section-head" style="font-size:14px;margin-bottom:16px">STAGING / COMMAND POST</div>
        ${incident.staging_name ? `<div style="font-size:22px;font-weight:900;color:#111;margin-bottom:6px">${esc(incident.staging_name)}</div>` : ""}
        ${incident.staging_address ? `<div style="font-size:15px;color:#555;margin-bottom:16px">${esc(incident.staging_address)}</div>` : ""}
        ${mapsUrl ? `<a href="${esc(mapsUrl)}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Open in Google Maps ↗</a>` : ""}
        ${(incident.staging_lat && incident.staging_lng) ? `<div style="margin-top:10px;font-family:monospace;font-size:13px;color:#888">${incident.staging_lat.toFixed(6)}, ${incident.staging_lng.toFixed(6)}</div>` : ""}
      </div>
      <div class="footer">
        <div class="footer-left">
          <img src="${origin}/matzil-logo.avif" class="footer-emblem" alt="" />
          <div><div class="footer-org">MATZIL SEARCH &amp; RESCUE</div></div>
        </div>
      </div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Missing Person — ${esc(incident.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #e5e5e5; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }

    .print-bar { background: #111; color: #fff; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .print-bar span { font-size: 13px; color: #aaa; }
    .print-btn { background: #dc2626; color: #fff; border: none; border-radius: 6px; padding: 9px 20px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .print-btn:hover { background: #b91c1c; }

    .poster {
      background: #fff;
      max-width: 780px;
      margin: 24px auto;
      border-radius: 4px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      min-height: 1050px;
      overflow: hidden;
    }
    @media print {
      .poster { margin: 0; box-shadow: none; border-radius: 0; min-height: 100vh; }
    }

    .top-bar {
      background: #dc2626;
      padding: 18px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo-words { height: 36px; width: auto; filter: brightness(0) invert(1); }
    .missing-label {
      background: #111;
      color: #fff;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 3px;
      padding: 6px 16px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .name-block {
      background: #1a1a2e;
      padding: 20px 28px 18px;
      border-bottom: 4px solid #dc2626;
    }
    .name {
      font-size: 36px;
      font-weight: 900;
      color: #fff;
      letter-spacing: -0.5px;
      line-height: 1.1;
      text-transform: uppercase;
    }
    .aka { font-size: 14px; color: #aaa; margin-top: 4px; }

    .body-cols {
      display: flex;
      gap: 0;
      flex: 1;
      padding: 24px 28px;
      gap: 24px;
      align-items: flex-start;
    }

    .photo-col { width: 200px; flex-shrink: 0; }
    .subject-photo {
      width: 200px;
      height: 250px;
      object-fit: cover;
      border-radius: 6px;
      border: 3px solid #dc2626;
      display: block;
    }
    .photo-placeholder {
      width: 200px;
      height: 250px;
      background: #f0f0f0;
      border-radius: 6px;
      border: 3px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      color: #bbb;
      letter-spacing: 1px;
    }
    .last-seen-stamp {
      margin-top: 12px;
      background: #dc2626;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
    }
    .ls-label { font-size: 9px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,0.7); text-transform: uppercase; }
    .ls-date { font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px; line-height: 1.3; }

    .info-col { flex: 1; min-width: 0; }
    .section-head {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #dc2626;
      text-transform: uppercase;
      border-bottom: 2px solid #dc2626;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }

    .dl-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .dl { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px 4px 0; width: 40%; vertical-align: top; }
    .dv { font-size: 14px; font-weight: 600; color: #111; padding: 4px 0; }

    .detail-text { font-size: 14px; color: #333; line-height: 1.5; }

    .alert-bar {
      margin: 0 28px 20px;
      background: #fffbe6;
      border: 2px solid #f59e0b;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 14px;
      color: #333;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .alert-icon { font-size: 18px; flex-shrink: 0; }

    .notes-bar {
      margin: 0 28px 20px;
      font-size: 13px;
      color: #666;
      font-style: italic;
      padding: 10px 16px;
      border-left: 3px solid #dc2626;
      background: #fff5f5;
    }

    .footer {
      background: #1a1a2e;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: auto;
    }
    .footer-left { display: flex; align-items: center; gap: 14px; }
    .footer-emblem { height: 40px; width: auto; filter: brightness(0) invert(1); opacity: 0.9; }
    .footer-org { font-size: 13px; font-weight: 900; color: #fff; letter-spacing: 1px; }
    .footer-sub { font-size: 11px; color: #dc2626; margin-top: 2px; font-weight: 600; }
    .footer-right { text-align: right; }
    .footer-date { font-size: 12px; color: #aaa; }
    .footer-ref { font-size: 11px; color: #666; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>${esc(incident.incident_number)} — ${esc(incident.title)}</span>
    <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
  </div>

  ${postersHtml}
  ${stagingHtml}
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
