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
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function heightFt(inches: number) {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function drow(label: string, value: string | null): string {
  if (!value) return "";
  return `<div class="drow"><span class="dl">${label}</span><span class="dv">${esc(value)}</span></div>`;
}

function subjectFlyer(s: Subject, origin: string): string {
  const name     = val(s.full_name) ?? "UNKNOWN";
  const aka      = val(s.also_known_as);
  const age      = val(s.age_estimate);
  const gender   = val(s.gender);
  const height   = s.height_cm ? heightFt(s.height_cm) : null;
  const weight   = s.weight_kg ? `${s.weight_kg} lbs` : null;
  const hair     = [val(s.hair_color), val(s.hair_length)].filter(Boolean).join(", ") || null;
  const eyes     = val(s.eye_color);
  const build    = val(s.build);
  const skin     = val(s.skin_tone);
  const wearing  = val(s.last_seen_wearing);
  const location = val(s.last_seen_location);
  const lastSeen = s.last_seen_at ? fmtDate(s.last_seen_at) : null;
  const features = val(s.distinguishing_features);
  const medical  = val(s.medical_conditions);

  const detailRows = [
    drow("GENDER", gender),
    drow("AGE", age),
    drow("HEIGHT", height),
    drow("WEIGHT", weight),
    drow("BUILD", build),
    drow("HAIR", hair),
    drow("EYES", eyes),
    drow("SKIN TONE", skin),
    drow("LAST SEEN", lastSeen),
    drow("LOCATION", location),
    drow("WEARING", wearing),
    drow("FEATURES", features),
    medical ? drow("⚠ MEDICAL", medical) : "",
  ].filter(Boolean).join("");

  return `
<div class="poster">

  <!-- ORG HEADER -->
  <div class="org-header">
    <img src="${origin}/matzil-logo.avif" class="org-logo" alt="" onerror="this.style.display='none'" />
    <div class="org-text">
      <div class="org-name">MATZIL SAR</div>
      <div class="org-sub">Search &amp; Rescue</div>
    </div>
    <img src="${origin}/matzil-words.avif" class="org-words" alt="" onerror="this.style.display='none'" />
  </div>

  <!-- MISSING PERSON BANNER -->
  <div class="banner">MISSING PERSON</div>

  <!-- SUBJECT NAME BLOCK -->
  <div class="name-block">
    <div class="name-main">${esc(name)}</div>
    ${aka ? `<div class="name-aka">Also known as: ${esc(aka)}</div>` : ""}
  </div>

  <!-- BODY: photo left + details right -->
  <div class="body">
    <div class="photo-col">
      ${s.photo_url
        ? `<img src="${esc(s.photo_url)}" class="photo" alt="${esc(name)}" />`
        : `<div class="no-photo">
             <img src="${origin}/matzil-logo.avif" class="np-logo" alt="" onerror="this.style.display='none'" />
             <div class="np-text">NO PHOTO<br>AVAILABLE</div>
           </div>`
      }
    </div>
    <div class="details-col">
      ${detailRows}
    </div>
  </div>

  <!-- SEEN BAR -->
  <div class="seen-bar">
    IF YOU HAVE SEEN THIS PERSON OR HAVE ANY INFORMATION REGARDING THEIR WHEREABOUTS — CONTACT MATZIL IMMEDIATELY
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="hotline-wrap">
      <div class="hotline-label">MATZIL HOTLINE</div>
      <div class="hotline-num">647-557-6735</div>
      <div class="hotline-sub">24 HOURS A DAY · 7 DAYS A WEEK</div>
    </div>
    <div class="emergency-wrap">
      <div class="emergency-label">EMERGENCY</div>
      <div class="emergency-num">911</div>
    </div>
  </div>

  <!-- TAGLINE -->
  <div class="tagline">So Others May Live</div>

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
    : `<div class="poster empty-poster">
        <img src="${origin}/matzil-logo.avif" style="height:80px;opacity:0.15;filter:brightness(0) invert(1)" alt="" />
        <p>No subject info yet.<br>Add a subject in the <strong>Subject</strong> tab.</p>
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
      background: #2a2a2a;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      html, body { background: #fff; }
      .toolbar { display: none !important; }
      .poster { margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; page-break-after: always; }
    }

    /* Toolbar */
    .toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #111; padding: 9px 20px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2px solid #333;
    }
    .toolbar-title { font-size: 13px; color: #666; }
    .toolbar-btns { display: flex; gap: 8px; }
    .btn-print {
      background: #E94E1B; color: #fff; border: none; border-radius: 5px;
      padding: 7px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .btn-print:hover { background: #c73e12; }
    .btn-img {
      background: transparent; color: #E94E1B; border: 2px solid #E94E1B; border-radius: 5px;
      padding: 5px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .btn-img:hover { background: #2a1208; }
    .btn-img:disabled { opacity: 0.4; cursor: wait; }

    /* ── POSTER ── */
    .poster {
      width: 816px;
      height: 1056px;
      margin: 50px auto 40px;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 8px 48px rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .empty-poster {
      align-items: center; justify-content: center; gap: 16px;
      background: #111; color: #555; font-size: 16px; text-align: center; line-height: 1.7;
    }

    /* Header */
    .org-header {
      background: #E94E1B;
      padding: 12px 22px;
      display: flex; align-items: center; gap: 16px;
      flex-shrink: 0;
    }
    .org-logo { height: 68px; width: auto; filter: brightness(0) invert(1); flex-shrink: 0; }
    .org-text { flex: 1; }
    .org-name { font-size: 26px; font-weight: 900; color: #fff; letter-spacing: 3px; line-height: 1; }
    .org-sub  { font-size: 12px; color: rgba(255,255,255,0.8); letter-spacing: 2px; margin-top: 3px; }
    .org-words { height: 44px; width: auto; filter: brightness(0) invert(1); flex-shrink: 0; }

    /* MISSING PERSON */
    .banner {
      background: #fff;
      color: #E94E1B;
      text-align: center;
      font-size: 82px;
      font-weight: 900;
      letter-spacing: 2px;
      padding: 4px 0 0;
      line-height: 1;
      border-bottom: 6px solid #E94E1B;
      flex-shrink: 0;
    }

    /* Name block */
    .name-block {
      background: #111;
      padding: 12px 24px;
      text-align: center;
      flex-shrink: 0;
    }
    .name-main { font-size: 46px; font-weight: 900; color: #fff; letter-spacing: 2px; line-height: 1; text-transform: uppercase; }
    .name-aka  { font-size: 13px; color: #888; letter-spacing: 1px; margin-top: 4px; text-transform: uppercase; }

    /* Body */
    .body {
      display: flex;
      height: 470px;
      flex-shrink: 0;
      border-bottom: 4px solid #E94E1B;
    }

    /* Photo */
    .photo-col {
      width: 295px;
      flex-shrink: 0;
      border-right: 4px solid #E94E1B;
      overflow: hidden;
      background: #111;
    }
    .photo { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
    .no-photo {
      width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
    }
    .np-logo { height: 70px; opacity: 0.12; filter: brightness(0) invert(1); }
    .np-text { font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #444; text-align: center; line-height: 1.6; }

    /* Details — flex column, space-between so rows fill the height */
    .details-col {
      flex: 1;
      padding: 8px 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .drow {
      display: flex;
      align-items: center;
      padding: 0 18px;
      flex: 1;
      border-bottom: 1px solid #efefef;
    }
    .drow:last-child { border-bottom: none; }
    .dl {
      font-size: 10.5px;
      font-weight: 900;
      color: #E94E1B;
      letter-spacing: 1px;
      text-transform: uppercase;
      width: 88px;
      flex-shrink: 0;
    }
    .dv {
      font-size: 18px;
      font-weight: 700;
      color: #111;
      line-height: 1.25;
    }

    /* Seen bar */
    .seen-bar {
      background: #f5f5f5;
      border-top: 2px solid #ddd;
      padding: 10px 20px;
      font-size: 11px;
      font-weight: 800;
      color: #222;
      text-align: center;
      letter-spacing: 0.4px;
      flex-shrink: 0;
    }

    /* Footer */
    .footer {
      background: #111;
      display: flex;
      align-items: stretch;
      flex: 1;
    }
    .hotline-wrap {
      flex: 1;
      padding: 0 28px;
      display: flex; flex-direction: column; justify-content: center; gap: 4px;
    }
    .hotline-label { font-size: 11px; font-weight: 900; color: #888; letter-spacing: 2px; text-transform: uppercase; }
    .hotline-num   { font-size: 52px; font-weight: 900; color: #fff; letter-spacing: 1px; line-height: 1; }
    .hotline-sub   { font-size: 10px; font-weight: 700; color: #555; letter-spacing: 1.5px; text-transform: uppercase; }
    .emergency-wrap {
      background: #E94E1B;
      padding: 0 32px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .emergency-label { font-size: 10px; font-weight: 900; color: rgba(255,255,255,0.7); letter-spacing: 2px; text-transform: uppercase; }
    .emergency-num   { font-size: 72px; font-weight: 900; color: #fff; line-height: 1; }

    /* Tagline */
    .tagline {
      background: #E94E1B;
      padding: 8px 20px;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 3px;
      color: rgba(255,255,255,0.9);
      text-transform: uppercase;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">${esc(incident?.title)}</span>
    <div class="toolbar-btns">
      <button class="btn-print" onclick="window.print()">🖨 Print / Save PDF</button>
      <button class="btn-img" id="dl-btn" onclick="downloadImage()">⬇ Download Image</button>
    </div>
  </div>
  ${postersHtml}
  <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
  <script>
    async function downloadImage() {
      const btn = document.getElementById('dl-btn');
      btn.disabled = true; btn.textContent = 'Rendering…';
      try {
        const posters = document.querySelectorAll('.poster');
        for (let i = 0; i < posters.length; i++) {
          const canvas = await html2canvas(posters[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 816, height: 1056 });
          const a = document.createElement('a');
          a.download = 'missing-person' + (posters.length > 1 ? '-' + (i+1) : '') + '.png';
          a.href = canvas.toDataURL('image/png');
          a.click();
        }
      } finally { btn.disabled = false; btn.innerHTML = '⬇ Download Image'; }
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
