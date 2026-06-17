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

function row(label: string, value: string | null): string {
  if (!value) return "";
  return `
    <tr>
      <td class="rl">${label}:</td>
      <td class="rv">${esc(value)}</td>
    </tr>`;
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

  return `
<div class="poster">

  <!-- ORG HEADER -->
  <div class="org-header">
    <img src="${origin}/matzil-logo.avif" class="org-logo" alt="" />
    <div class="org-text">
      <div class="org-name">MATZIL SAR</div>
      <div class="org-sub">Search &amp; Rescue</div>
    </div>
    <img src="${origin}/matzil-words.avif" class="org-words" alt="Matzil SAR" />
  </div>

  <!-- MISSING PERSON BANNER -->
  <div class="banner">MISSING PERSON</div>

  <!-- BODY: photo + details -->
  <div class="body">

    <!-- Photo -->
    <div class="photo-col">
      ${s.photo_url
        ? `<img src="${esc(s.photo_url)}" class="photo" alt="${esc(name)}" />`
        : `<div class="no-photo">
             <img src="${origin}/matzil-logo.avif" class="no-photo-logo" alt="" />
             <span>NO PHOTO<br>AVAILABLE</span>
           </div>`
      }
    </div>

    <!-- Details -->
    <div class="details-col">
      <table class="details-table">
        <tbody>
          ${row("NAME", name + (aka ? ` (${aka})` : ""))}
          ${row("GENDER", gender)}
          ${row("AGE", age)}
          ${row("LAST SEEN", lastSeen)}
          ${row("LOCATION", location)}
          <tr><td colspan="2" class="spacer"></td></tr>
          ${row("HEIGHT", height)}
          ${row("WEIGHT", weight)}
          ${row("BUILD", build)}
          ${row("HAIR", hair)}
          ${row("EYES", eyes)}
          ${row("SKIN", skin)}
          <tr><td colspan="2" class="spacer"></td></tr>
          ${row("WEARING", wearing)}
          ${row("FEATURES", features)}
          ${medical ? row("MEDICAL", medical) : ""}
        </tbody>
      </table>
    </div>
  </div>

  <!-- IF YOU HAVE SEEN bar -->
  <div class="seen-bar">
    IF YOU HAVE SEEN THIS PERSON OR HAVE ANY INFORMATION REGARDING THEIR WHEREABOUTS, PLEASE CONTACT MATZIL IMMEDIATELY.
  </div>

  <!-- CONTACT FOOTER -->
  <div class="contact-footer">
    <div class="contact-left">
      <div class="hotline-label">MATZIL<br>HOTLINE</div>
      <div class="hotline-num">647-557-6735</div>
      <div class="hotline-sub">24 HOURS A DAY</div>
    </div>
    <div class="contact-right">
      <div class="emergency-label">EMERGENCY</div>
      <div class="emergency-num">911</div>
    </div>
  </div>

  <!-- BOTTOM TAG -->
  <div class="bottom-tag">
    By The Community, For The Community
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
      background: #333;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      html, body { background: #fff; }
      .print-bar { display: none !important; }
      .poster { width: 100%; height: 100vh; margin: 0; box-shadow: none; page-break-after: always; }
    }

    /* Print bar */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #111; padding: 10px 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .print-bar span { font-size: 13px; color: #666; }
    .print-btn {
      background: #E94E1B; color: #fff; border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .print-btn:hover { background: #c73e12; }

    /* Poster */
    .poster {
      width: 816px;
      min-height: 1056px;
      margin: 52px auto 32px;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 8px 48px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Org header */
    .org-header {
      background: #E94E1B;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .org-logo {
      height: 52px; width: auto;
      filter: brightness(0) invert(1);
    }
    .org-text { flex: 1; }
    .org-name {
      font-size: 22px; font-weight: 900; color: #fff;
      letter-spacing: 2px; line-height: 1;
    }
    .org-sub {
      font-size: 11px; color: rgba(255,255,255,0.75);
      letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;
    }
    .org-words {
      height: 36px; width: auto;
      filter: brightness(0) invert(1); opacity: 0.9;
    }

    /* MISSING PERSON banner */
    .banner {
      background: #fff;
      color: #E94E1B;
      text-align: center;
      font-size: 72px;
      font-weight: 900;
      letter-spacing: 4px;
      padding: 8px 0 4px;
      line-height: 1;
      text-transform: uppercase;
      border-bottom: 5px solid #E94E1B;
      flex-shrink: 0;
    }

    /* Body */
    .body {
      display: flex;
      flex: 1;
      gap: 0;
      border-bottom: 3px solid #E94E1B;
    }

    /* Photo col */
    .photo-col {
      width: 300px;
      flex-shrink: 0;
      border-right: 3px solid #E94E1B;
      background: #111;
    }
    .photo {
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: center top;
      display: block;
    }
    .no-photo {
      width: 100%; height: 100%; min-height: 340px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 14px;
      background: #1a1a1a;
    }
    .no-photo-logo { height: 64px; opacity: 0.15; filter: brightness(0) invert(1); }
    .no-photo span { font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #555; text-align: center; }

    /* Details col */
    .details-col {
      flex: 1;
      padding: 18px 20px;
    }
    .details-table { width: 100%; border-collapse: collapse; }
    .rl {
      font-size: 12px;
      font-weight: 900;
      color: #E94E1B;
      letter-spacing: 0.5px;
      padding: 5px 12px 5px 0;
      vertical-align: top;
      white-space: nowrap;
      width: 90px;
    }
    .rv {
      font-size: 15px;
      font-weight: 700;
      color: #111;
      padding: 5px 0;
      vertical-align: top;
      line-height: 1.3;
    }
    .spacer { height: 8px; }

    /* If you have seen bar */
    .seen-bar {
      background: #f5f5f5;
      border-top: 2px solid #ddd;
      padding: 10px 20px;
      font-size: 11px;
      font-weight: 700;
      color: #333;
      text-align: center;
      letter-spacing: 0.3px;
      line-height: 1.5;
      flex-shrink: 0;
    }

    /* Contact footer */
    .contact-footer {
      background: #E94E1B;
      display: flex;
      align-items: stretch;
      flex-shrink: 0;
    }
    .contact-left {
      flex: 1;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .hotline-label {
      font-size: 13px;
      font-weight: 900;
      color: rgba(255,255,255,0.85);
      letter-spacing: 1px;
      line-height: 1.2;
      text-align: center;
    }
    .hotline-num {
      font-size: 38px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 1px;
      line-height: 1;
    }
    .hotline-sub {
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.7);
      letter-spacing: 1.5px;
      margin-top: 2px;
    }
    .contact-right {
      background: #111;
      padding: 16px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .emergency-label {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #888;
      text-transform: uppercase;
    }
    .emergency-num {
      font-size: 52px;
      font-weight: 900;
      color: #E94E1B;
      line-height: 1;
    }

    /* Bottom tag */
    .bottom-tag {
      background: #111;
      padding: 7px 20px;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #555;
      text-transform: uppercase;
      flex-shrink: 0;
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
