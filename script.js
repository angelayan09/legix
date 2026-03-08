const SERVER = "http://localhost:5001";

async function queryOllama(prompt) {
  const response = await fetch("http://localhost:5001/api/ollama", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3.2",
      prompt: prompt,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].text;
}

// mayas stuff
function isCongressUrl(url) {
  try {
    return new URL(url).hostname.includes("congress.gov");
  } catch {
    return false;
  }
}

async function fetchCongressBill(url) {
  const res = await fetch(`${SERVER}/api/congress?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch bill data");
  }
  return res.json();
}

function isCongressUrl(url) {
  try {
    return new URL(url).hostname.includes("congress.gov");
  } catch {
    return false;
  }
}

function renderBillMetadata({ details, sponsor, progress }) {
  const metaDiv = document.getElementById("billMetadata");
  if (!metaDiv) return;

  const recentActionsHtml = progress.recentActions.map(a => `
    <div class="action-item">
      <span class="action-date">${a.date}</span>
      <span class="action-text">${a.text}</span>
    </div>
  `).join("");

  const subjectsHtml = details.subjects.slice(0, 6).map(s =>
    `<span class="subject-tag">${s}</span>`
  ).join("");

  metaDiv.innerHTML = `
    <div class="meta-card">
      <div class="meta-header">
        <div class="meta-badge">${details.billType} ${details.billNumber}</div>
        <div class="meta-congress">${progress.congress}th Congress &bull; ${progress.chamber}</div>
      </div>
      <h3 class="meta-title">${details.title}</h3>
      ${details.shortTitle ? `<p class="meta-subtitle">${details.shortTitle}</p>` : ""}
      <div class="meta-grid">
        <div class="meta-block">
          <div class="meta-label">Sponsor</div>
          <div class="meta-value sponsor-name">${sponsor.name}</div>
          <div class="meta-sub">
            ${sponsor.party} &bull; ${sponsor.state}
            ${sponsor.district ? ` District ${sponsor.district}` : ""}
          </div>
        </div>
        <div class="meta-block">
          <div class="meta-label">Introduced</div>
          <div class="meta-value">${progress.introduced}</div>
        </div>
        <div class="meta-block">
          <div class="meta-label">Cosponsors</div>
          <div class="meta-value">${details.cosponsors}</div>
        </div>
        <div class="meta-block">
          <div class="meta-label">Latest Action</div>
          <div class="meta-value status-badge">${progress.latestActionDate}</div>
          <div class="meta-sub">${progress.latestActionText}</div>
        </div>
      </div>
      <div class="meta-timeline">
        <div class="meta-label" style="margin-bottom:8px;">Recent Activity</div>
        ${recentActionsHtml || "<p>No actions recorded.</p>"}
      </div>
      ${subjectsHtml ? `
        <div class="meta-subjects">
          <div class="meta-label" style="margin-bottom:6px;">Subject Areas</div>
          <div class="subjects-list">${subjectsHtml}</div>
        </div>` : ""}
    </div>
  `;
  metaDiv.style.display = "block";

  function setLoading(active, message = "") {
    const el = document.getElementById("statusMsg");
    if (!el) return;
    el.style.display = active ? "block" : "none";
    el.style.color = "#333";
    el.innerText = message;
  }

  function showError(msg) {
    const el = document.getElementById("statusMsg");
    if (!el) return;
    el.style.display = "block";
    el.style.color = "#c0392b";
    el.innerText = "⚠️ " + msg;
  }
}

// ----------------------------
// Simplify Button Event
// ----------------------------
document.getElementById("simplifyBtn").addEventListener("click", async () => {
  const textArea = document.getElementById("textInput");
  const fileInput = document.getElementById("fileInput");
  const urlInput = document.getElementById("urlInput");

  let legalText = "";
  let isCongressBill = false;
  let billMeta = null;

  // 1️⃣ Priority: textarea
  if (textArea.value.trim() !== "") {
    legalText = textArea.value.trim();
  }
  // 2️⃣ Next: file
  else if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    legalText = await readFile(file);
  }
  // 3️⃣ Last: URL
 else if (urlInput.value.trim() !== "") {
    const url = urlInput.value.trim();

      if (isCongressUrl(url)) {
        setLoading(true, "Fetching bill from Congress.gov...");
        try {
          billMeta = await fetchCongressBill(url);
          renderBillMetadata(billMeta);
          isCongressBill = true;
          legalText = billMeta.billText;

          if (!legalText) {
            setLoading(false);
            showError("Bill found, but full text is not yet available on Congress.gov.");
            return;
          }
        } catch (err) {
          setLoading(false);
          showError("Error fetching bill: " + err.message);
          return;
        }
      } else {
        legalText = await fetchTextFromURL(url);
      }

    } else {
      alert("Please provide text, upload a file, or enter a URL.");
      return;
    }

    if (!legalText) {
      showError("Could not retrieve any text to simplify.");
      return;
    }


  const prompt = `Simplify the following legal text into plain, easy-to-understand English:\n\n${legalText}. Only output the simplified text and nothing else.`;

  // Show loading
  const simplifiedDiv = document.getElementById("simplifiedText");
  const simplifiedOutput = document.getElementById("simplifiedOutput");
  simplifiedDiv.style.display = "block";
  simplifiedOutput.innerText = "Simplifying...";

  const summaryDiv = document.getElementById("summaryText");
  const summaryOutput = document.getElementById("summaryOutput");
  summaryDiv.style.display = "block";
  summaryOutput.innerText = "Generating summary...";

  const analysisDiv = document.getElementById("analysisText");
  const analysisOutput = document.getElementById("analysisOutput");
  analysisDiv.style.display = "block";
  analysisOutput.innerText = "Analyzing...";

  try {
    const simplified = await queryOllama(prompt);
    simplifiedOutput.innerText = simplified;

    const prompt1 = `Summarize the following text into short bullet point(s):\n${simplified}. Only output the summarized text and nothing else.`
    const summary = await queryOllama(prompt1);
    summaryOutput.innerText = summary;

    const prompt2 = `Extract the obligations/duties, rights/protections/benefits, penalties/risks, and important dates/deadlines in plain, easy-to-understand English from the following text:\n${legalText}. Output these 4 exact headers along with the extracted information under each, and nothing else.`
    const analysis = await queryOllama(prompt2);
    analysisOutput.innerText = analysis;

  } catch (err) {
    simplifiedOutput.innerText = "Error: " + err.message;
    console.error(err);
  }

  // ----------------------------
  // Take Action Buttons
  // ----------------------------
  const billName = legalText.slice(0, 50) + (legalText.length > 50 ? "..." : "");
  const zip = document.getElementById("zipInput").value.trim();
  const actionLinks = getTakeActionLinks(billName, zip);

  const actionOutput = document.getElementById("actionOutput");
  actionOutput.innerHTML = ""; // clear old
  actionLinks.forEach(action => {
    const li = document.createElement("li");
    li.style.marginBottom = "10px";
    li.innerHTML = `
      <span style="margin-right:8px;">${action.icon}</span>
      <strong>${action.label}</strong>
      <a href="${action.link}" target="_blank" class="action-button">${action.display}</a>
    `;
    actionOutput.appendChild(li);
  });
});

// ----------------------------
// Translate Button
// ----------------------------
  document.getElementById("translateBtn").addEventListener("click", async () => {
  const language = document.getElementById("languageSelect").value;
  const simpOutput = document.getElementById("simplifiedOutput");
  const summOutput = document.getElementById("summaryOutput");
  const analyOutput = document.getElementById("analysisOutput");
  const simp = simpOutput.innerText;
  const summ = summOutput.innerText;
  const analy = analyOutput.innerText;
  
  if (!simp) {
    alert("Please simplify text first.");
    return;
  }
  simpOutput.innerText = "Translating...";
  summOutput.innerText = "Translating...";
  analyOutput.innerText = "Translating...";

  try {
    const translateSimplifiedPrompt =
      `Fully translate the following text into ${language}. Only output the translated text:\n\n${simp}`;
    const translatedSimplified = await queryOllama(translateSimplifiedPrompt);
    simpOutput.innerText = translatedSimplified;
    
    const translateSummaryPrompt =
      `Fully translate the following text into ${language}. Only output the translated text:\n\n${summ}`;
    const translatedSummary = await queryOllama(translateSummaryPrompt);
    summOutput.innerText = translatedSummary;

    const translateAnalysisPrompt =
      `Fully translate the following text into ${language}. Only output the translated text:\n\n${analy}`;
    const translatedAnalysis = await queryOllama(translateAnalysisPrompt);
    analyOutput.innerText = translatedAnalysis;

  } catch (err) {
    console.error(err);
  }

});

// ----------------------------
// Helper: Read text from uploaded file
// ----------------------------
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject("Failed to read file.");
    reader.readAsText(file);
  });
}

// ----------------------------
// Helper: Fetch text from URL
// ----------------------------
async function fetchTextFromURL(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch URL");
    const text = await res.text();
    return text;
  } catch (err) {
    console.error(err);
    return "";
  }
}

function getTakeActionLinks(billName, zip) {
  const shortLabel = billName.split(" ").slice(0, 5).join(" ") + (billName.split(" ").length > 5 ? "..." : "");
  const actions = [
    { icon: "🖊️", label: "Sign a Petition             ", display: `Sign petition about ${shortLabel}`, query: `Sign petition about ${billName}` },
    { icon: "📞", label: "Contact Local Representative", display: zip ? `Contact local representative ${zip}` : null, query: zip ? `Contact local representative ${zip}` : null },
    { icon: "🏛️", label: "Find City/Town Hall         ", display: zip ? `City hall near ${zip}` : null, query: zip ? `City hall near ${zip}` : null }
  ];

  return actions.filter(a => a.query)
    .map(a => ({ ...a, link: `https://www.google.com/search?q=${encodeURIComponent(a.query)}` }));
}