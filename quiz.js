let viewer, currentProtein, options, answered, score, rounds, maxRounds;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function init() {
  viewer = $3Dmol.createViewer(document.getElementById("mol-viewer"), {
    backgroundColor: "#1a1d2e",
  });
  resetGame();
}

function resetGame() {
  score = 0;
  rounds = 0;
  maxRounds = 10;
  document.getElementById("score").textContent = "";
  document.getElementById("new-btn").style.display = "none";
  nextRound();
}

const CAT_HINTS = {
  "Receptor": "Membrane receptor involved in signal transduction.",
  "Kinase": "Enzyme that transfers phosphate groups.",
  "Tumor suppressor": "Protein that prevents uncontrolled cell growth.",
  "Oncogene": "Protein that can drive cancer when mutated.",
  "Cytokine": "Signaling molecule of the immune system.",
  "Growth factor": "Stimulates cell growth or differentiation.",
  "Transcription factor": "Regulates gene expression by binding DNA.",
  "Chaperone": "Helps other proteins fold correctly.",
  "Enzyme": "Catalyzes biochemical reactions.",
  "Apoptosis regulator": "Controls programmed cell death.",
  "Coagulation": "Involved in the blood clotting cascade.",
  "Nuclear receptor": "Receptor that works inside the nucleus.",
  "Transport": "Moves molecules through the body.",
  "Adhesion": "Mediates cell-cell or cell-matrix attachment.",
  "Signaling": "Transduces signals within or between cells.",
  "Immune system": "Part of host defense against pathogens.",
  "Ion channel": "Forms pores for ion transport across membranes.",
  "Epigenetic reader": "Recognizes chemical marks on DNA or histones.",
  "Epigenetic modifier": "Adds or removes marks on chromatin.",
  "Hormone": "Chemical messenger in the bloodstream.",
  "Membrane protein": "Embedded in cell membranes.",
  "Protease inhibitor": "Blocks protease activity.",
  "Lipid transport": "Moves lipids between tissues.",
  "Chemokine": "Attracts immune cells to inflammation sites.",
  "Acute phase protein": "Levels change during inflammation.",
  "E3 ligase": "Tags proteins for degradation via ubiquitin.",
  "Structural protein": "Provides mechanical support to cells/tissues.",
  "GTPase": "Molecular switch cycling between active/inactive states.",
};

async function nextRound() {
  if (rounds >= maxRounds) {
    showFinalScore();
    return;
  }
  rounds++;
  answered = false;
  document.getElementById("result").textContent = "";
  document.getElementById("explanation").textContent = "";
  document.getElementById("next-btn").style.display = "none";
  document.getElementById("new-btn").style.display = "none";
  document.getElementById("options").innerHTML = "";
  document.getElementById("question").textContent = "Which protein is shown above?";

  // pick a random protein
  currentProtein = pickRandom(PROTEINS);

  // pick wrong options: prefer same category for harder picks
  const sameCat = shuffle(PROTEINS.filter(p => p.id !== currentProtein.id && p.cat === currentProtein.cat));
  const diffCat = shuffle(PROTEINS.filter(p => p.id !== currentProtein.id && p.cat !== currentProtein.cat));
  const wrongs = [...sameCat.slice(0, 2), ...diffCat.slice(0, 2)].slice(0, 3);
  options = shuffle([currentProtein, ...wrongs]);

  // update info bar
  document.getElementById("uniprot-id").textContent = "UniProt: " + currentProtein.id;
  document.getElementById("residue-count").textContent = "Loading…";
  document.getElementById("protein-category").textContent = currentProtein.cat;

  // category-based hint (vague)
  document.getElementById("hint-function").textContent = CAT_HINTS[currentProtein.cat] || "A human protein with known predicted structure.";
  document.getElementById("hint-letters").textContent = "";

  // load structure from AlphaFold API
  const overlay = document.getElementById("loading-overlay");
  overlay.style.display = "flex";

  try {
    const apiResp = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${currentProtein.id}`);
    if (!apiResp.ok) throw new Error("API HTTP " + apiResp.status);
    const apiData = await apiResp.json();
    const pdbUrl = apiData[0].pdbUrl;

    const resp = await fetch(pdbUrl);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const pdb = await resp.text();

    viewer.removeAllModels();
    viewer.addModel(pdb, "pdb");

    viewer.setStyle({}, {
      cartoon: {
        color: "spectrum",
        style: "oval",
        thickness: 0.3
      }
    });
    viewer.zoomTo();
    viewer.zoom(0.85);
    viewer.spin("y", 0.8);
    viewer.render();

    // count residues
    const lines = pdb.split("\n");
    const residues = new Set();
    lines.forEach(line => {
      if (line.startsWith("ATOM") && line.substring(12, 16).trim() === "CA") {
        residues.add(line.substring(22, 26).trim());
      }
    });
    document.getElementById("residue-count").textContent = residues.size + " residues";
  } catch (e) {
    document.getElementById("residue-count").textContent = "Error loading";
    console.error("Failed to load structure:", e);
  }

  overlay.style.display = "none";

  // render option buttons
  const optDiv = document.getElementById("options");
  options.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.textContent = p.name;
    btn.onclick = () => selectAnswer(i, btn);
    optDiv.appendChild(btn);
  });

  updateScore();
}

function selectAnswer(idx, btn) {
  if (answered) return;
  answered = true;
  viewer.spin("y", 0);

  const correct = options[idx] === currentProtein;
  const buttons = document.querySelectorAll(".opt-btn");

  buttons.forEach((b, i) => {
    b.classList.add("disabled");
    if (options[i] === currentProtein) b.classList.add("correct");
  });

  if (correct) {
    score++;
    btn.classList.add("correct");
    document.getElementById("result").textContent = "✅ Correct!";
    document.getElementById("result").className = "win";
  } else {
    btn.classList.add("wrong");
    document.getElementById("result").textContent = `❌ Nope — it's ${currentProtein.name}`;
    document.getElementById("result").className = "lose";
  }

  document.getElementById("explanation").textContent = currentProtein.desc;

  if (rounds < maxRounds) {
    document.getElementById("next-btn").style.display = "";
  } else {
    document.getElementById("new-btn").style.display = "";
  }
  updateScore();
}

function updateScore() {
  document.getElementById("score").textContent = `Round ${rounds}/${maxRounds} · Score: ${score}/${rounds - (answered ? 0 : 1)}`;
}

function showFinalScore() {
  const pct = Math.round((score / maxRounds) * 100);
  let emoji = "🏆";
  if (pct < 30) emoji = "🔬";
  else if (pct < 60) emoji = "🧪";
  else if (pct < 80) emoji = "🧬";

  document.getElementById("question").textContent = "Game Over!";
  document.getElementById("result").textContent = `${emoji} Final score: ${score}/${maxRounds} (${pct}%)`;
  document.getElementById("result").className = score >= maxRounds / 2 ? "win" : "lose";
  document.getElementById("explanation").textContent = score === maxRounds
    ? "Perfect score! You really know your proteins."
    : score >= 7
    ? "Great job! Solid protein knowledge."
    : score >= 4
    ? "Not bad! Keep studying those structures."
    : "Tough game — those proteins all look alike in cartoon mode!";
  document.getElementById("next-btn").style.display = "none";
  document.getElementById("new-btn").style.display = "";
}

document.addEventListener("DOMContentLoaded", init);
