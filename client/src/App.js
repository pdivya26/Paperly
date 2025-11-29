import React, { useState, useEffect } from "react";
import "./App.css";

const ACRONYMS = ["IEEE", "ACM", "NASA"];
const SPECIAL_CASES = ["arXiv", "OpenAlex"];

function formatSourceName(str) {
  if (!str) return "";

  return str
    .split(" ")
    .map(word => {
      if (SPECIAL_CASES.includes(word)) return word;
      if (ACRONYMS.includes(word.toUpperCase())) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatSummary(text) {
  return text
    .split("\n\n")
    .map((paragraph, idx) => (
      <p key={idx}
         dangerouslySetInnerHTML={{ __html: paragraph.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }}
      />
    ));
}

function App() {
  const [topic, setTopic] = useState("");
  const [papers, setPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState([]);
  const [sortBy, setSortBy] = useState("Relevance");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!topic) return;

    // Clear previous results and filters before fetching new ones
    setPapers([]);
    setFilteredPapers([]);
    setSelectedSources([]);
    setSortBy("Relevance");

    setLoading(true);

    try {
      const res = await fetch(
        `http://localhost:5000/papers?topic=${encodeURIComponent(topic)}`
      );
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setPapers(data.papers);
      setFilteredPapers(data.papers);
    } catch (err) {
      console.error("Failed to fetch papers:", err);
      alert("Failed to fetch papers.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilterAndSort = () => {
    let temp = [...papers];

    if (selectedSources.length > 0) {
      temp = temp.filter((p) => selectedSources.includes(p.source));
    }

    switch (sortBy) {
      case "Relevance":
        temp.sort((a, b) => {
          // relevance score = (citations + 1) weighted by recency
          const currentYear = new Date().getFullYear();
          const scoreA = (a.citations + 1) * (1 / (currentYear - (a.year || currentYear) + 1));
          const scoreB = (b.citations + 1) * (1 / (currentYear - (b.year || currentYear) + 1));
          return scoreB - scoreA; // higher score = more relevant
        });
        break;
      case "Newest":
        temp.sort((a, b) => b.year - a.year);
        break;
      case "Oldest":
        temp.sort((a, b) => a.year - b.year);
        break;
      case "Most Cited":
        temp.sort((a, b) => b.citations - a.citations);
        break;
      case "Least Cited":
        temp.sort((a, b) => a.citations - b.citations);
        break;
      case "A to Z":
        temp.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "Z to A":
        temp.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        break;
    }

    setFilteredPapers(temp);
  };

  useEffect(() => {
    applyFilterAndSort();
  }, [selectedSources, sortBy, papers]);

  const sources = Array.from(new Set(papers.map((p) => p.source)));

  console.log("[Frontend] Available sources:", sources);

  const handleCheckboxChange = (source) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  return (
    <div className="app-container">

      {/* Hero Section */}
      <div className="hero">
        <h1 className="project-title">Paperly</h1>

        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter your research topic"
            required
          />
          <button type="submit">Search</button>
        </form>
      </div>

      {papers.length > 0 && (
        <div className="filters-container">
          <div className="filters">
            <strong>Filter by Source:</strong><br />
            {sources.map((s, i) => (
              <label key={i} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(s)}
                  onChange={() => handleCheckboxChange(s)}
                />{" "}
                {formatSourceName(s)}
              </label>
            ))}
          </div>

          <div className="sort-by">
            <label>
              <strong>Sort by</strong>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="Relevance">Relevance</option>
                <option value="Newest">Newest → Oldest</option>
                <option value="Oldest">Oldest → Newest</option>
                <option value="Most Cited">Most Cited → Least Cited</option>
                <option value="Least Cited">Least Cited → Most Cited</option>
                <option value="A to Z">A → Z</option>
                <option value="Z to A">Z → A</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {loading && <p className="loading">Loading papers...</p>}

      {filteredPapers.map((p, idx) => (
        <PaperCard key={idx} paper={p} index={idx} />
      ))}
    </div>
  );
}

function PaperCard({ paper, index }) {
  const [related, setRelated] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchRelated = async () => {
    setLoadingRelated(true);
    try {
      const res = await fetch(`http://localhost:5000/related?index=${index}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setRelated(data.relatedPapers || []);
    } catch (err) {
      console.error("Failed to fetch related papers:", err);
      alert("Failed to fetch related papers.");
    } finally {
      setLoadingRelated(false);
    }
  };

  const summarizePaper = async () => {
    console.log("[Frontend] summarizePaper function triggered");
    
    if (paper.geminiSummary) {
      setSummary(paper.geminiSummary);
      return;
    }

    setLoadingSummary(true);

    try {
      console.log("[Frontend] Sending data to /summarize", { title: paper.title, summary: paper.summary });

      const res = await fetch("http://localhost:5000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        title: paper.title,
        summary: paper.summary,
        authors: paper.authors,
        year: paper.year
      }),});

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();
      console.log("[Frontend] Summarize response data:", data);

      setSummary(data.summary);

      paper.geminiSummary = data.summary;
    } catch (err) {
      console.error("[Frontend] Summarization failed:", err);
      alert("Failed to summarize the paper.");
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="paper-card">
      <h3>
        <a href={paper.link} target="_blank" rel="noopener noreferrer">
          {paper.title}
        </a>
      </h3>

      <p>{paper.summary}</p>

      <small>
        Authors: {paper.authors.join(", ")} | Source: {formatSourceName(paper.source)}
        {paper.citations > 0 && ` | Citations: ${paper.citations}`}
        {paper.year > 0 && ` | Year: ${paper.year}`}
      </small>


      <div className="buttons-container">
        <button
          className="related-button"
          onClick={fetchRelated}
          disabled={loadingRelated}
        >See Related Papers
        </button>

        <button
          className="summary-button"
          onClick={summarizePaper}
          disabled={loadingSummary}
        >Summarize
        </button>
      </div>

      {loadingSummary && <p id="smry-loading" className="loading">Summarizing paper...</p>}
      {summary && (
        <div className="summary-result">
          {formatSummary(summary)}
        </div>
      )}


      {loadingRelated && <p className="loading">Loading related papers...</p>}

      {related.length > 0 && (
        <div className="related-papers">
          {related.map((r, i) => (
            <div key={i}>
              <a href={r.link} target="_blank" rel="noopener noreferrer">
                {r.title}
              </a>
              <p>{r.summary}</p>
              <small>
                Source: {formatSourceName(r.source)}
                {r.citations > 0 && ` | Citations: ${r.citations}`}
                {r.year > 0 && ` | Year: ${r.year}`}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
