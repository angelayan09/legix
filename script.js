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

// ----------------------------
// Simplify Button Event
// ----------------------------
document.getElementById("simplifyBtn").addEventListener("click", async () => {
  const textArea = document.getElementById("textInput");
  const urlInput = document.getElementById("urlInput");

  let legalText = ""
  
  // 1️⃣ Priority: textarea
  if (textArea.value.trim() !== "") {
    legalText = textArea.value.trim();
  }
  // 3️⃣ Last: URL
  else if (urlInput.value.trim() !== "") {
    legalText = await fetchTextFromURL(urlInput.value.trim());
  } 
  else {
    alert("Please provide text, upload a file, or enter a URL.");
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

  const impactPrompt = `
Analyze the following law and determine who it most affects: ${legalText}

Return the answer in the following sections:

Impact Score: 
• A numerical score from 1-10. Then one of the words LOW (if score 1-3), MEDIUM (if 4-7), or HIGH (if 8-10) in parentheses following the number. Then a colored square emoji (🟥 8-10, 🟧 4-7, 🟨 1-3) based on impact score.

Groups Affected
• List the main groups of people impacted.

Industries Affected
• List industries or professions impacted.

Geographic Scope
• Explain where the law applies (city/state/national).

Demographic Insights
• Mention income groups, renters/homeowners, students, age groups, gender groups, ethnic/racial groups etc if relevant.

Only output these sections and nothing else.
`;
const impactDiv = document.getElementById("impactText");
const impactOutput = document.getElementById("impactOutput");

impactDiv.style.display = "block";
impactOutput.innerText = "Discovering impact...";
const impact = await queryOllama(impactPrompt);
impactOutput.innerText = impact;

  if (!zip) {
    alert("Enter a ZIP code to show demographics");
    return;
  }

  const demographics = await fetchDemographics(zip);
  if (demographics) {
    document.getElementById("charts").style.display = "block";
    renderDemographicsCharts(demographics);
  }

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
// Fetch Census Data by ZIP
// ----------------------------
async function fetchDemographics(zip) {
  try {
    /*const ageBuckets = {
      "0-17": ["B01001_003E","B01001_004E","B01001_005E","B01001_006E",
               "B01001_027E","B01001_028E","B01001_029E","B01001_030E"],
      "18-24": ["B01001_007E","B01001_008E","B01001_031E","B01001_032E"],
      "25-39": ["B01001_009E","B01001_010E","B01001_011E",
                "B01001_033E","B01001_034E","B01001_035E"],
      "40-64": ["B01001_012E","B01001_013E","B01001_014E","B01001_015E",
                "B01001_016E","B01001_017E","B01001_036E","B01001_037E",
                "B01001_038E","B01001_039E","B01001_040E","B01001_041E"],
      "65+": ["B01001_018E","B01001_019E","B01001_020E","B01001_021E",
              "B01001_022E","B01001_023E","B01001_042E","B01001_043E",
              "B01001_044E","B01001_045E","B01001_046E","B01001_047E"]
    };*/
    const ageBuckets = {
      "0-17": ["B01001_027E","B01001_028E","B01001_029E","B01001_030E"],
      "18-24": ["B01001_007E","B01001_008E","B01001_031E","B01001_032E"],
      "25-39": ["B01001_009E","B01001_010E","B01001_011E",
                "B01001_033E","B01001_034E","B01001_035E"],
      "40-64": ["B01001_014E","B01001_015E",
                "B01001_016E","B01001_017E","B01001_036E","B01001_037E",
                "B01001_038E","B01001_039E"],
      "65+": ["B01001_020E","B01001_021E",
              "B01001_022E","B01001_023E","B01001_042E","B01001_043E",
              "B01001_044E","B01001_045E"]
    };
    const ageVars = Object.values(ageBuckets).flat();
    const raceVars = ["B02001_002E","B02001_003E","B02001_004E","B02001_005E","B02001_006E"];

    const url = `https://api.census.gov/data/2021/acs/acs5?get=${[...ageVars,...raceVars].join(",")}&for=zip%20code%20tabulation%20area:${zip}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Census API fetch failed");

    const data = await res.json();
    const [header, values] = data;

    const ageData = Object.keys(ageBuckets).map(bucket => 
    ageBuckets[bucket].reduce((sum,varName) => sum + Number(values[header.indexOf(varName)] || 0), 0)
    );
    const ageLabels = Object.keys(ageBuckets);

    const raceData = raceVars.map(v => Number(values[header.indexOf(v)] || 0));
    const raceLabels = ["White","Black","American Indian","Asian","Other"];

    return { ageData, ageLabels, raceData, raceLabels };

  } catch(err) {
    console.error(err);
    return null;
  }
}

// ----------------------------
// Render Charts
// ----------------------------
let ageChartInstance;
let raceChartInstance;

function renderDemographicsCharts(demo) {
  if (!demo) return;

  document.getElementById("charts").style.display = "block";

  // Destroy old charts
  if (ageChartInstance) ageChartInstance.destroy();
  if (raceChartInstance) raceChartInstance.destroy();

  const ageCtx = document.getElementById("ageChart");
  ageChartInstance = new Chart(ageCtx, {
    type: 'bar',
    data: {
      labels: demo.ageLabels,
      datasets: [{
        label: "Population by Age",
        data: demo.ageData,
        backgroundColor: "#36A2EB"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "Age Distribution" }
      }
    }
  });

  const raceCtx = document.getElementById("raceChart");
  raceChartInstance = new Chart(raceCtx, {
    type: 'pie',
    data: {
      labels: demo.raceLabels,
      datasets: [{
        label: "Population by Race/Ethnicity",
        data: demo.raceData,
        backgroundColor: ["#FF6384","#36A2EB","#9966FF","#4BC0C0","#FF9F40"]
      }]
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Race/Ethnicity Distribution" } }
    }
  });
}