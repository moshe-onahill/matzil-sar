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

function val(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t === "none" || t === "n/a" || t === "na" || t === "-") return null;
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
  const name    = val(s.full_name) ?? "UNKNOWN";
  const aka     = val(s.also_known_as);
  const age     = val(s.age_estimate);
  const gender  = val(s.gender);
  const height  = s.height_cm ? heightFt(s.height_cm) : null;
  const weight  = s.weight_kg ? `${s.weight_kg} lbs` : null;
  const hair    = val(s.hair_color) ? `${val(s.hair_color)}${val(s.hair_length) ? ` ${val(s.hair_length)}` : ""}` : null;
  const eyes    = val(s.eye_color);
  const build   = val(s.build);
  const skin    = val(s.skin_tone);
  const wearing = val(s.last_seen_wearing);
  const location = val(s.last_seen_location);
  const lastSeen = s.last_seen_at ? fmtDate(s.last_seen_at) : null;
  const features = val(s.distinguishing_features);
  const medical  = val(s.medical_conditions);

  const descItems = [
    gender  ? `<div class="desc-item"><span class="desc-k">Gender</span><span class="desc-v">${esc(gender)}</span></div>` : "",
    age     ? `<div class="desc-item"><span class="desc-k">Age</span><span class="desc-v">${esc(age)}</span></div>` : "",
    height  ? `<div class="desc-item"><span class="desc-k">Height</span><span class="desc-v">${esc(height)}</span></div>` : "",
    weight  ? `<div class="desc-item"><span class="desc-k">Weight</span><span class="desc-v">${esc(weight)}</span></div>` : "",
    hair    ? `<div class="desc-item"><span class="desc-k">Hair</span><span class="desc-v">${esc(hair)}</span></div>` : "",
    eyes    ? `<div class="desc-item"><span class="desc-k">Eyes</span><span class="desc-v">${esc(eyes)}</span></div>` : "",
    build   ? `<div class="desc-item"><span class="desc-k">Build</span><span class="desc-v">${esc(build)}</span></div>` : "",
    skin    ? `<div class="desc-item"><span class="desc-k">Skin</span><span class="desc-v">${esc(skin)}</span></div>` : "",
  ].filter(Boolean).join("");

  return `
<div class="poster">

  <!-- TOP HEADER -->
  <div class="header">
    <img src="${origin}/matzil-words.avif" class="wordmark" alt="Matzil SAR" />
    <div class="header-right">
      <div class="missing-text">MISSING</div>
    </div>
  </div>

  <!-- PHOTO -->
  <div class="photo-wrap">
    ${s.photo_url
      ? `<img src="${esc(s.photo_url)}" class="photo" alt="${esc(name)}" />`
      : `<div class="photo no-photo">
           <img src="${origin}/matzil-logo.avif" class="no-photo-logo" alt="" />
           <div class="no-photo-text">NO PHOTO AVAILABLE</div>
         </div>`
    }
    ${lastSeen ? `<div class="last-seen-stamp">LAST SEEN &nbsp;·&nbsp; ${esc(lastSeen)}</div>` : ""}
  </div>

  <!-- NAME BLOCK -->
  <div class="name-block">
    <div class="name">${esc(name)}</div>
    ${aka ? `<div class="aka">Known as &ldquo;${esc(aka)}&rdquo;</div>` : ""}
  </div>

  <!-- DETAILS STRIP -->
  ${descItems ? `<div class="desc-strip">${descItems}</div>` : ""}

  <!-- LAST SEEN / WEARING -->
  ${(location || wearing || features) ? `
  <div class="info-section">
    ${location ? `<div class="info-row"><span class="info-k">Last seen at</span><span class="info-v">${esc(location)}</span></div>` : ""}
    ${wearing  ? `<div class="info-row"><span class="info-k">Last seen wearing</span><span class="info-v">${esc(wearing)}</span></div>` : ""}
    ${features ? `<div class="info-row"><span class="info-k">Distinguishing features</span><span class="info-v">${esc(features)}</span></div>` : ""}
  </div>` : ""}

  ${medical ? `
  <div class="medical-row">
    <span class="med-icon">⚕</span>
    <span><strong>Medical:</strong> ${esc(medical)}</span>
  </div>` : ""}

  <!-- SPACER -->
  <div style="flex:1"></div>

  <!-- FOOTER / CONTACT -->
  <div class="footer">
    <div class="footer-top">
      <div class="contact-label">IF YOU HAVE ANY INFORMATION — CONTACT US IMMEDIATELY</div>
      <div class="contact-number">1-833-628-9457</div>
      <div class="contact-sub">or call 911 in an emergency</div>
    </div>
    <div class="footer-bottom">
      <img src="${origin}/matzil-logo.avif" class="footer-emblem" alt="" />
      <div class="footer-brand">MATZIL SEARCH &amp; RESCUE</div>
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
        <img src="${origin}/matzil-logo.avif" style="height:90px;opacity:0.2" alt="" />
        <p style="color:#999;font-size:16px;text-align:center;line-height:1.6">No subject info yet.<br>Add a subject in the <strong>Subject</strong> tab.</p>
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
      background: #222;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      html, body { background: #fff; }
      .print-bar { display: none !important; }
      .poster { width: 100%; height: 100vh; margin: 0; box-shadow: none; page-break-after: always; }
    }

    /* ── Print bar ── */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #111; padding: 10px 24px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .print-bar span { font-size: 13px; color: #666; }
    .print-btn {
      background: #E94E1B; color: #fff; border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .print-btn:hover { background: #c73e12; }

    /* ── Poster ── */
    .poster {
      width: 816px;
      height: 1056px;
      margin: 52px auto 32px;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 8px 48px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ── */
    .header {
      background: #E94E1B;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .wordmark {
      height: 28px; width: auto;
      filter: brightness(0) invert(1);
    }
    .missing-text {
      font-size: 36px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 12px;
      line-height: 1;
      text-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }

    /* ── Photo ── */
    .photo-wrap {
      position: relative;
      flex-shrink: 0;
      height: 420px;
      background: #111;
      overflow: hidden;
    }
    .photo {
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: center top;
      display: block;
    }
    .no-photo {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px;
    }
    .no-photo-logo { height: 80px; width: auto; opacity: 0.15; filter: brightness(0) invert(1); }
    .no-photo-text { font-size: 14px; font-weight: 700; letter-spacing: 3px; color: #555; }
    .last-seen-stamp {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: rgba(0,0,0,0.78);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 10px 20px;
      text-align: center;
    }
    .last-seen-stamp strong { color: #E94E1B; }

    /* ── Name block ── */
    .name-block {
      background: #111;
      padding: 16px 24px 14px;
      flex-shrink: 0;
    }
    .name {
      font-size: 52px;
      font-weight: 900;
      color: #fff;
      letter-spacing: -1px;
      line-height: 1;
      text-transform: uppercase;
    }
    .aka { font-size: 15px; color: #aaa; margin-top: 4px; }

    /* ── Description strip ── */
    .desc-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      background: #f9f9f9;
      border-bottom: 2px solid #eee;
      flex-shrink: 0;
    }
    .desc-item {
      display: flex;
      flex-direction: column;
      padding: 8px 18px;
      border-right: 1px solid #eee;
      gap: 1px;
    }
    .desc-k {
      font-size: 8px; font-weight: 800; letter-spacing: 1.5px;
      color: #E94E1B; text-transform: uppercase;
    }
    .desc-v {
      font-size: 14px; font-weight: 700; color: #111;
    }

    /* ── Info section ── */
    .info-section {
      padding: 14px 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .info-row { display: flex; gap: 12px; align-items: baseline; }
    .info-k {
      font-size: 9px; font-weight: 800; letter-spacing: 1.5px;
      color: #999; text-transform: uppercase;
      flex-shrink: 0; width: 160px;
    }
    .info-v { font-size: 14px; color: #222; line-height: 1.4; }

    /* ── Medical ── */
    .medical-row {
      margin: 0 24px 8px;
      background: #fff8f0;
      border: 2px solid #E94E1B;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 13px; color: #333;
      display: flex; gap: 8px; align-items: flex-start;
      flex-shrink: 0;
    }
    .med-icon { font-size: 15px; flex-shrink: 0; }

    /* ── Footer ── */
    .footer {
      background: #111;
      flex-shrink: 0;
    }
    .footer-top {
      padding: 18px 24px 16px;
      text-align: center;
      border-bottom: 1px solid #222;
    }
    .contact-label {
      font-size: 9px; font-weight: 800; letter-spacing: 2.5px;
      color: #666; text-transform: uppercase; margin-bottom: 4px;
    }
    .contact-number {
      font-size: 40px; font-weight: 900;
      color: #E94E1B; letter-spacing: 2px; line-height: 1;
    }
    .contact-sub {
      font-size: 11px; color: #555; margin-top: 4px; letter-spacing: 0.5px;
    }
    .footer-bottom {
      padding: 10px 24px;
      display: flex; align-items: center; gap: 12px;
      justify-content: center;
    }
    .footer-emblem {
      height: 28px; width: auto;
      filter: brightness(0) invert(1); opacity: 0.6;
    }
    .footer-brand {
      font-size: 11px; font-weight: 800; letter-spacing: 3px;
      color: #444; text-transform: uppercase;
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
