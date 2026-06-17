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

// Returns null if value is blank / "none" / "n/a"
function val(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (t === "" || t === "none" || t === "n/a" || t === "na" || t === "-") return null;
  return s.trim();
}

function fmtDate(dt: string | null) {
  if (!dt) return "";
  return new Date(dt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function heightFt(inches: number) {
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

function subjectFlyer(s: Subject, origin: string): string {
  const name = val(s.full_name) ?? "UNKNOWN";
  const aka = val(s.also_known_as);
  const age = val(s.age_estimate);
  const gender = val(s.gender);
  const height = s.height_cm ? heightFt(s.height_cm) : null;
  const weight = s.weight_kg ? `${s.weight_kg} lbs` : null;
  const hair = val(s.hair_color) ? `${val(s.hair_color)}${val(s.hair_length) ? `, ${val(s.hair_length)}` : ""}` : null;
  const eyes = val(s.eye_color);
  const build = val(s.build);
  const skin = val(s.skin_tone);
  const wearing = val(s.last_seen_wearing);
  const location = val(s.last_seen_location);
  const lastSeen = s.last_seen_at ? fmtDate(s.last_seen_at) : null;
  const features = val(s.distinguishing_features);
  const medical = val(s.medical_conditions);
  const notes = val(s.notes);

  const descPills = [
    gender ? `<div class="pill"><span class="pill-k">Gender</span><span class="pill-v">${esc(gender)}</span></div>` : "",
    age ? `<div class="pill"><span class="pill-k">Age</span><span class="pill-v">${esc(age)}</span></div>` : "",
    height ? `<div class="pill"><span class="pill-k">Height</span><span class="pill-v">${esc(height)}</span></div>` : "",
    weight ? `<div class="pill"><span class="pill-k">Weight</span><span class="pill-v">${esc(weight)}</span></div>` : "",
    hair ? `<div class="pill"><span class="pill-k">Hair</span><span class="pill-v">${esc(hair)}</span></div>` : "",
    eyes ? `<div class="pill"><span class="pill-k">Eyes</span><span class="pill-v">${esc(eyes)}</span></div>` : "",
    build ? `<div class="pill"><span class="pill-k">Build</span><span class="pill-v">${esc(build)}</span></div>` : "",
    skin ? `<div class="pill"><span class="pill-k">Skin</span><span class="pill-v">${esc(skin)}</span></div>` : "",
  ].join("");

  return `
<div class="poster">

  <!-- TOP BAR -->
  <div class="top-bar">
    <img src="${origin}/matzil-words.avif" class="wordmark" alt="Matzil SAR" />
    <div class="top-right">
      <span class="missing-word">MISSING</span>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- LEFT: Photo -->
    <div class="photo-col">
      ${s.photo_url
        ? `<img src="${esc(s.photo_url)}" class="photo" alt="${esc(name)}" />`
        : `<div class="photo no-photo">
             <img src="${origin}/matzil-logo.avif" class="no-photo-logo" alt="" />
             <span>NO PHOTO<br>AVAILABLE</span>
           </div>`
      }
    </div>

    <!-- RIGHT: Info -->
    <div class="info-col">

      <div class="subject-name">${esc(name)}</div>
      ${aka ? `<div class="aka">"${esc(aka)}"</div>` : ""}

      ${(lastSeen || location) ? `
      <div class="last-seen-box">
        ${lastSeen ? `
        <div class="ls-row">
          <div class="ls-key">LAST SEEN</div>
          <div class="ls-val">${esc(lastSeen)}</div>
        </div>` : ""}
        ${location ? `
        <div class="ls-row" style="margin-top:${lastSeen ? "8px" : "0"}">
          <div class="ls-key">LOCATION</div>
          <div class="ls-val">${esc(location)}</div>
        </div>` : ""}
      </div>` : ""}

      ${descPills ? `<div class="pills">${descPills}</div>` : ""}

      ${wearing ? `
      <div class="field">
        <div class="field-label">LAST SEEN WEARING</div>
        <div class="field-val">${esc(wearing)}</div>
      </div>` : ""}

      ${features ? `
      <div class="field">
        <div class="field-label">DISTINGUISHING FEATURES</div>
        <div class="field-val">${esc(features)}</div>
      </div>` : ""}

      ${medical ? `
      <div class="med-bar">
        <span class="med-icon">⚕</span>
        <div><strong>Medical:</strong> ${esc(medical)}</div>
      </div>` : ""}

      ${notes ? `<div class="notes">${esc(notes)}</div>` : ""}

    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <img src="${origin}/matzil-logo.avif" class="footer-logo" alt="" />
    <div class="footer-cta">
      <div class="cta-line1">IF YOU HAVE ANY INFORMATION</div>
      <div class="cta-line2">1-833-628-9457</div>
      <div class="cta-line3">or call 911 in an emergency</div>
    </div>
    <div class="footer-brand">
      <div class="brand-name">MATZIL SAR</div>
      <div class="brand-sub">Search &amp; Rescue</div>
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

  const [{ data: incident }, { data: rawSubjects, error: subjectsError }] = await Promise.all([
    supabase.from("incidents").select("id,incident_number,title").eq("id", id).single(),
    supabase.from("incident_subjects").select("*").eq("incident_id", id).order("created_at"),
  ]);

  if (!incident) return new NextResponse("Incident not found", { status: 404 });
  if (subjectsError) return new NextResponse(`DB error: ${subjectsError.message}`, { status: 500, headers: { "Content-Type": "text/plain" } });

  const subjects = (rawSubjects ?? []) as Subject[];

  const postersHtml = subjects.length > 0
    ? subjects.map((s) => subjectFlyer(s, origin)).join("")
    : `<div class="poster" style="align-items:center;justify-content:center;gap:20px">
        <img src="${origin}/matzil-logo.avif" style="height:90px;opacity:0.25" alt="" />
        <p style="color:#aaa;font-size:16px;text-align:center;line-height:1.6">No subject info yet.<br>Add a subject in the <strong>Subject</strong> tab.</p>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Missing — ${esc(incident?.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      background: #1a1a1a;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @media print {
      html, body { background: white; }
      .print-bar { display: none !important; }
      .poster {
        width: 100vw;
        height: 100vh;
        margin: 0;
        box-shadow: none;
        border-radius: 0;
        page-break-after: always;
      }
    }

    /* ── Print bar ── */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 100;
      background: #111;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .print-bar span { font-size: 13px; color: #666; }
    .print-btn {
      background: #E94E1B;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.3px;
    }
    .print-btn:hover { background: #c73e12; }

    /* ── Poster ── */
    .poster {
      width: 816px;        /* US Letter @ 96dpi */
      height: 1056px;
      margin: 52px auto 32px;
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Top bar ── */
    .top-bar {
      background: #E94E1B;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .wordmark {
      height: 32px;
      width: auto;
      filter: brightness(0) invert(1);
    }
    .missing-word {
      font-size: 42px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 10px;
      line-height: 1;
      text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    /* ── Body ── */
    .body {
      display: flex;
      flex: 1;
      gap: 0;
      min-height: 0;
    }

    /* ── Photo column ── */
    .photo-col {
      width: 280px;
      flex-shrink: 0;
      background: #111;
      display: flex;
      align-items: stretch;
    }
    .photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .no-photo {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: #1a1a1a;
      color: #555;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-align: center;
    }
    .no-photo-logo {
      height: 72px;
      width: auto;
      opacity: 0.2;
      filter: brightness(0) invert(1);
    }

    /* ── Info column ── */
    .info-col {
      flex: 1;
      padding: 28px 28px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
      overflow: hidden;
    }

    .subject-name {
      font-size: 42px;
      font-weight: 900;
      color: #111;
      line-height: 1;
      letter-spacing: -1px;
      text-transform: uppercase;
    }
    .aka {
      font-size: 15px;
      color: #6b7280;
      margin-top: -8px;
    }

    /* ── Last seen box ── */
    .last-seen-box {
      background: #E94E1B;
      border-radius: 8px;
      padding: 14px 18px;
    }
    .ls-row { display: flex; align-items: flex-start; gap: 12px; }
    .ls-key {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.6);
      flex-shrink: 0;
      width: 78px;
      padding-top: 2px;
    }
    .ls-val {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
    }

    /* ── Pills ── */
    .pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill {
      display: flex;
      align-items: baseline;
      gap: 5px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 5px;
      padding: 4px 10px;
    }
    .pill-k {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #9ca3af;
      text-transform: uppercase;
    }
    .pill-v {
      font-size: 13px;
      font-weight: 700;
      color: #111;
    }

    /* ── Fields ── */
    .field {}
    .field-label {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #E94E1B;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .field-val {
      font-size: 14px;
      color: #222;
      line-height: 1.5;
    }

    /* ── Medical ── */
    .med-bar {
      background: #fefce8;
      border: 2px solid #fbbf24;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      color: #333;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .med-icon { font-size: 16px; flex-shrink: 0; }

    .notes {
      font-size: 12px;
      color: #6b7280;
      font-style: italic;
      border-left: 3px solid #E94E1B;
      padding-left: 10px;
    }

    /* ── Footer ── */
    .footer {
      background: #111;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-shrink: 0;
    }
    .footer-logo {
      height: 44px;
      width: auto;
      filter: brightness(0) invert(1);
      opacity: 0.8;
    }
    .footer-cta { flex: 1; text-align: center; }
    .cta-line1 {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2.5px;
      color: #9ca3af;
      text-transform: uppercase;
    }
    .cta-line2 {
      font-size: 20px;
      font-weight: 900;
      color: #E94E1B;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .cta-line3 {
      font-size: 11px;
      color: #6b7280;
      margin-top: 3px;
      letter-spacing: 0.5px;
    }
    .footer-brand { text-align: right; }
    .brand-name {
      font-size: 14px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 2px;
    }
    .brand-sub {
      font-size: 10px;
      color: #6b7280;
      margin-top: 1px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span>${esc(incident?.title)}</span>
    <button class="print-btn" onclick="window.print()">🖨&nbsp; Print / Save PDF</button>
  </div>
  ${postersHtml}
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
