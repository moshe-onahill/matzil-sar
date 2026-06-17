import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type Subject = {
  id: string;
  full_name: string | null;
  also_known_as: string | null;
  date_of_birth: string | null;
  age_estimate: string | null;
  gender: string | null;
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

function chip(label: string, value: string | null | number | undefined) {
  if (!value) return "";
  return `<div class="chip"><span class="chip-label">${label}</span><span class="chip-val">${esc(String(value))}</span></div>`;
}

function subjectFlyer(s: Subject, origin: string): string {
  const physChips = [
    chip("Gender", s.gender),
    chip("Age", s.age_estimate || (s.date_of_birth ? `DOB ${s.date_of_birth}` : null)),
    chip("Height", s.height_cm ? (() => { const totalIn = Math.round(s.height_cm! / 2.54); return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`; })() : null),
    chip("Weight", s.weight_kg ? `${Math.round(s.weight_kg! * 2.205)} lbs` : null),
    chip("Hair", s.hair_color ? `${s.hair_color}${s.hair_length ? `, ${s.hair_length}` : ""}` : null),
    chip("Eyes", s.eye_color),
    chip("Build", s.build),
    chip("Skin", s.skin_tone),
  ].join("");

  return `
<div class="page">

  <!-- Top stripe -->
  <div class="top-stripe">
    <img src="${origin}/matzil-words.avif" alt="Matzil SAR" class="wordmark" />
  </div>

  <!-- MISSING banner -->
  <div class="missing-banner">MISSING</div>

  <!-- Main content -->
  <div class="main">

    <!-- Photo -->
    <div class="photo-wrap">
      ${s.photo_url
        ? `<img src="${esc(s.photo_url)}" class="photo" alt="${esc(s.full_name)}" />`
        : `<div class="photo no-photo">NO PHOTO<br>AVAILABLE</div>`
      }
    </div>

    <!-- Info -->
    <div class="info">

      <div class="subject-name">${esc(s.full_name) || "UNKNOWN"}</div>
      ${s.also_known_as ? `<div class="subject-aka">"${esc(s.also_known_as)}"</div>` : ""}

      ${(s.last_seen_at || s.last_seen_location) ? `
      <div class="last-seen-block">
        ${s.last_seen_at ? `<div class="ls-row"><span class="ls-key">LAST SEEN</span><span class="ls-val">${fmtDate(s.last_seen_at)}</span></div>` : ""}
        ${s.last_seen_location ? `<div class="ls-row"><span class="ls-key">LOCATION</span><span class="ls-val">${esc(s.last_seen_location)}</span></div>` : ""}
      </div>` : ""}

      ${physChips ? `<div class="chips">${physChips}</div>` : ""}

      ${s.last_seen_wearing ? `
      <div class="field-block">
        <div class="field-label">LAST SEEN WEARING</div>
        <div class="field-val">${esc(s.last_seen_wearing)}</div>
      </div>` : ""}

      ${s.distinguishing_features ? `
      <div class="field-block">
        <div class="field-label">DISTINGUISHING FEATURES</div>
        <div class="field-val">${esc(s.distinguishing_features)}</div>
      </div>` : ""}

    </div>
  </div>

  ${s.medical_conditions ? `
  <div class="medical-bar">
    <span class="med-icon">⚕</span>
    <span><strong>Medical Alert:</strong> ${esc(s.medical_conditions)}</span>
  </div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <img src="${origin}/matzil-logo.avif" alt="" class="emblem" />
    <div class="cta">
      <div class="cta-top">IF YOU HAVE ANY INFORMATION</div>
      <div class="cta-num">CALL 911 OR LOCAL EMERGENCY SERVICES</div>
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
    supabase
      .from("incidents")
      .select("id,incident_number,title")
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

  if (subjectsError) {
    return new NextResponse(`Database error: ${subjectsError.message}`, { status: 500, headers: { "Content-Type": "text/plain" } });
  }

  const subjects = (rawSubjects ?? []) as Subject[];

  const body = subjects.length > 0
    ? subjects.map((s) => subjectFlyer(s, origin)).join("\n")
    : `<div class="page" style="align-items:center;justify-content:center;gap:16px">
        <img src="${origin}/matzil-logo.avif" style="height:80px;opacity:0.3" alt="" />
        <p style="color:#aaa;font-size:16px;text-align:center">No subject info yet.<br>Add a subject in the <strong>Subject</strong> tab.</p>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Missing — ${esc(incident?.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #d1d5db; font-family: Arial, Helvetica, sans-serif; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { page-break-after: always; box-shadow: none; margin: 0; }
    }

    /* Print bar */
    .print-bar { background: #111; color: #fff; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; }
    .print-bar span { font-size: 13px; color: #888; }
    .print-btn { background: #dc2626; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; }

    /* Page */
    .page {
      background: #fff;
      width: 794px;       /* A4 width at 96dpi */
      min-height: 1123px; /* A4 height */
      margin: 24px auto;
      box-shadow: 0 4px 24px rgba(0,0,0,0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Top stripe */
    .top-stripe {
      background: #dc2626;
      padding: 14px 28px;
      display: flex;
      align-items: center;
    }
    .wordmark { height: 30px; width: auto; filter: brightness(0) invert(1); }

    /* MISSING banner */
    .missing-banner {
      background: #111;
      color: #fff;
      text-align: center;
      font-size: 72px;
      font-weight: 900;
      letter-spacing: 18px;
      padding: 18px 0 14px;
      line-height: 1;
      text-transform: uppercase;
    }

    /* Main body */
    .main {
      display: flex;
      gap: 28px;
      padding: 28px 32px 20px;
      flex: 1;
    }

    /* Photo */
    .photo-wrap { flex-shrink: 0; }
    .photo {
      width: 240px;
      height: 310px;
      object-fit: cover;
      border-radius: 6px;
      border: 4px solid #dc2626;
      display: block;
    }
    .no-photo {
      width: 240px;
      height: 310px;
      background: #f3f4f6;
      border: 4px dashed #d1d5db;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: #9ca3af;
      letter-spacing: 1px;
      text-align: center;
    }

    /* Info column */
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }

    .subject-name {
      font-size: 38px;
      font-weight: 900;
      color: #111;
      line-height: 1.05;
      letter-spacing: -1px;
      text-transform: uppercase;
    }
    .subject-aka { font-size: 16px; color: #6b7280; margin-top: -8px; }

    /* Last seen block */
    .last-seen-block {
      background: #dc2626;
      border-radius: 6px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ls-row { display: flex; gap: 10px; align-items: baseline; }
    .ls-key {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.65);
      flex-shrink: 0;
      width: 72px;
    }
    .ls-val { font-size: 14px; font-weight: 700; color: #fff; line-height: 1.3; }

    /* Physical chips */
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      display: flex;
      gap: 6px;
      padding: 4px 10px;
      align-items: baseline;
    }
    .chip-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #9ca3af; text-transform: uppercase; }
    .chip-val { font-size: 13px; font-weight: 700; color: #111; }

    /* Field blocks */
    .field-block {}
    .field-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #dc2626; text-transform: uppercase; margin-bottom: 3px; }
    .field-val { font-size: 14px; color: #222; line-height: 1.5; }

    /* Medical bar */
    .medical-bar {
      margin: 0 32px 20px;
      background: #fefce8;
      border: 2px solid #fbbf24;
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 14px;
      color: #333;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .med-icon { font-size: 18px; flex-shrink: 0; }

    /* Footer */
    .footer {
      background: #111;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: auto;
    }
    .emblem { height: 44px; width: auto; filter: brightness(0) invert(1); opacity: 0.85; }
    .cta { flex: 1; text-align: center; }
    .cta-top { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #9ca3af; text-transform: uppercase; }
    .cta-num { font-size: 16px; font-weight: 900; color: #dc2626; letter-spacing: 0.5px; margin-top: 2px; }
    .footer-brand { text-align: right; }
    .brand-name { font-size: 15px; font-weight: 900; color: #fff; letter-spacing: 1px; }
    .brand-sub { font-size: 11px; color: #6b7280; margin-top: 1px; }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <span>${esc(incident?.title)}</span>
    <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
  </div>
  ${body}
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
