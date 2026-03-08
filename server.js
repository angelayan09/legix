const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
const PORT = 5001;

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY || "vhfpeh0XtX2qEdb8VgmSJvyvcKjPvf91JroNgEdN";

app.use(cors());
app.use(express.json());

function parseCongressUrl(url) {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        // /bill/119th-congress/house-bill/1234 --> ["bill", "119th-congress", "house-bill", "1234"]
        if (parts[0] != "bill" || parts.length < 4) return null;

        const congressRaw = parts[1];
        const congress = parseInt(congressRaw);
        const typeRaw = parts[2];
        const billNumber = parts[3];

        const typeMap = {
            "house-bill": "hr",
            "senate-bill": "s",
            "house-joint-resolution": "hjres",
            "senate-joint-resolution": "sjres",
            "house-concurrent-resolution": "hconres",
            "senate-concurrent-resolution": "sconres",
            "house-resolution": "hres",
            "senate-resolution": "sres",
        };
        const billType = typeMap[typeRaw];
        if (!billType || isNaN(congress)) return null;

        return { congress, billType, billNumber };
    }
    catch {
        return null;

    }
}

app.get("/api/congress", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({error: "Missing url parameter"});
    
    const parsed = parseCongressUrl(url);
    if (!parsed) {
        return res.status(400).json({ error: "Could not parse congress.gov URL. Make sure it looks like: https://www.congress.gov/bill/119th-congress/house-bill/1234"});
    }

    const { congress, billType, billNumber } = parsed;
    const base = 'https://api.congress.gov/v3/bill/${congress}/${billType}/${billNumber}';
    const key = `?api_key=${CONGRESS_API_KEY}&format=json`;

    try {
        const[detailRes, actionsRes, textRes] = await Promise.all([
        fetch(`${base}${key}`),           // bill title, sponsor, dates
        fetch(`${base}/actions${key}&limit=10`),   // action history / progression
        fetch(`${base}/text${key}&limit=5`),      // links to the actual bill text
    ]);

    const [detailData, actionsData, textData] = await Promise.all([
        detailRes.json(),
        actionsRes.json,
        textRes.json(),
    ]);
    
    const bill = detailData.bill || {};

    const sponsorRaw = bill.sponsors?.[0] || {};
    const sponsor = {
        name: sponsorRaw.fullName  || sponsorRaw.name || "Unknown",
      party:       sponsorRaw.party     || "Unknown",
      state:       sponsorRaw.state     || "Unknown",
      district:    sponsorRaw.district  ?? null,
      bioguideId:  sponsorRaw.bioguideId || null,
    };

    const actions = actionsData.actions || [];
    const latestAction = bill.latestAction || {};
    const progress = {
      latestActionText: latestAction.text          || "No action recorded",
      latestActionDate: latestAction.actionDate    || "Unknown",
      recentActions: actions.slice(0, 5).map(a => ({
        date: a.actionDate,
        text: a.text,
        type: a.type,
      })),
      introduced:     bill.introducedDate           || "Unknown",
      congress:       bill.congress                 || congress,
      chamber:        bill.originChamber            || "Unknown",
      status:         bill.policyArea?.name         || null,
    };

    const details = {
      title:       bill.title                       || "Untitled",
      shortTitle:  bill.shortTitle                  || null,
      billType:    bill.type                        || billType.toUpperCase(),
      billNumber:  bill.number                      || billNumber,
      updateDate:  bill.updateDate                  || null,
      subjects:    bill.subjects?.legislativeSubjects?.map(s => s.name) || [],
      cosponsors:  bill.cosponsors?.count           || 0,
      committees:  bill.committees?.count           || 0,
    };

    const textVersions = textData.textVersions || [];
    const preferred = textVersions.find(v =>
      v.type?.toLowerCase().includes("enrolled")
    ) || textVersions[0];

    const textFormats = preferred?.formats || [];
    const txtFormat = textFormats.find(f => f.type === "Formatted Text") ||
                      textFormats.find(f => f.type === "Formatted XML")  ||
                      textFormats[0];
    const textUrl = txtFormat?.url || null;

    let billText = null;
    if (textUrl) {
      try {
        const txtRes  = await fetch(textUrl);
        const rawHtml = await txtRes.text();
        // Strip HTML tags for clean text
        billText = rawHtml.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
        // Cap at ~15 000 chars so we don't blow up the LLM context
        if (billText.length > 15000) billText = billText.substring(0, 15000) + "\n\n[Text truncated for length]";
      } catch {
        billText = null;
      }
    }
    return res.json({ details, sponsor, progress, textUrl, billText });

    }
    
    catch (err) {
         console.error("Congress API error:", err);
    return res.status(500).json({ error: "Failed to fetch bill data: " + err.message });
    }
    });

    app.post("/api/ollama", async (req, res) => {
  const { model = "llama3.2", prompt, max_tokens = 1000 } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.statusText}`);
    const data = await ollamaRes.json();

    // Normalize to the shape the frontend already expects
    return res.json({ choices: [{ text: data.response }] });
  } catch (err) {
    console.error("Ollama error:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => console.log(`✅ Legix server running on http://localhost:${PORT}`));