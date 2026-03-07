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
// Simplify Button Event
// ----------------------------
document.getElementById("simplifyBtn").addEventListener("click", async () => {
  const textArea = document.getElementById("textInput");
  const fileInput = document.getElementById("fileInput");
  const urlInput = document.getElementById("urlInput");

  let legalText = ""
  
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
