import React, { useState, useEffect } from "react";
import "./App.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ACRONYMS = ["IEEE", "ACM", "NASA"];
const SPECIAL_CASES = ["arXiv", "OpenAlex"];

console.log("API:", process.env.REACT_APP_API_URL);

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
  const [uploading, setUploading] = useState(null);
  const [uploadedPaper, setUploadedPaper] = useState(null);
  const [uploadResults, setUploadResults] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!topic) return;

    // Clear previous results and filters before fetching new ones
    setUploadedPaper(null);
    setPapers([]);
    setFilteredPapers([]);
    setSelectedSources([]);
    setSortBy("Relevance");

    setLoading(true);

    try {
      const res = await fetch(
        `${API}/papers?topic=${encodeURIComponent(topic)}`
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("paper", file);

    try {
      // Step 1: Upload and Parse PDF
      const res = await fetch(`${API}/upload-search`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("PDF processing failed");
      const data = await res.json();

      // Step 2: Set the uploaded paper as a "Featured" result
      setUploadedPaper({
        title: data.title,
        summary: data.abstract,
        authors: [data.authors],
        source: "Uploaded PDF",
        year: "",
        citations: 0,
        link: ""
      });

      // Step 3: Automatically search for related papers using the Title
      setTopic(data.title);
      setLoading(true);
      
      const searchRes = await fetch(
        `${API}/papers?topic=${encodeURIComponent(data.title)}`
      );
      const searchData = await searchRes.json();
      
      setPapers(searchData.papers);
      setFilteredPapers(searchData.papers);

    } catch (err) {
      console.error("Upload failed:", err);
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
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
          <label className="upload-file" title="Upload a paper to find similar research">
          {uploading ? "Loading" : "Upload"}
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileUpload} 
            style={{ display: "none" }} 
          />
        </label>
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

      {/* 1. Show the uploaded paper FIRST if it exists */}
      {uploadedPaper && (
        <div className="uploaded-section" style={{ marginBottom: '40px' }}>
          <h2 style={{ textAlign: 'center', paddingLeft: "10px", color: "#fff" }}>
            Your Uploaded Document
          </h2>
          <PaperCard paper={uploadedPaper} index={-1} />
          
          <div style={{ textAlign: 'center', margin: '30px 0' }}>
            <h2 style={{ padding: '0 10px', color: '#fff' }}>
              Related Papers 
            </h2>
          </div>
        </div>
      )}

      {loading && <p className="loading">Loading papers...</p>}

      {/* 2. Show the search results SECOND */}
      {(
        filteredPapers.map((p, idx) => (
          <PaperCard key={idx} paper={p} index={idx} />
        ))
      )}

    </div>
  );
}

function PaperCard({ paper, index }) {
  const [related, setRelated] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  
  // This state controls if the related papers are visible or hidden
  const [showRelated, setShowRelated] = useState(false);

  // This handles the "See/Hide" logic
  const handleRelatedToggle = async () => {
    if (showRelated) {
      setShowRelated(false); // Hide if already open
      return;
    }

    if (related.length > 0) {
      setShowRelated(true); // Show without fetching if we already have them
      return;
    }

    setLoadingRelated(true);
    const url = index === -1 
      ? `${API}/papers?topic=${encodeURIComponent(paper.title)}` 
      : `${API}/related?index=${index}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const relatedDocs = data.relatedPapers || data.papers || [];
      setRelated(relatedDocs.slice(0, 5));
      setShowRelated(true);
    } catch (err) {
      alert("Failed to find related documents.");
    } finally {
      setLoadingRelated(false);
    }
  };

  const summarizePaper = async () => {
    // Check if we already have a summary stored in the paper object
    if (paper.groqSummary) { 
      setSummary(paper.groqSummary); 
      return; 
    }

    setLoadingSummary(true);

    try {
      const res = await fetch(`${API}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paper.title,
          summary: paper.summary, // This is the abstract/original summary
          authors: paper.authors,
          year: paper.year
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      
      // We expect the backend to return { summary: "..." }
      if (data.summary) {
        setSummary(data.summary);
        // Store it so we don't have to fetch it again if the user clicks twice
        paper.groqSummary = data.summary; 
      } else {
        throw new Error("No summary in response");
      }

    } catch (err) {
      console.log("Summarization failed:", err);
      alert("Summarization failed. Please check if your Backend is running and the Groq Key is valid.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const allAuthors = Array.isArray(paper.authors) ? paper.authors : [paper.authors || "Unknown"];
  const hasMore = allAuthors.length > 10;
  const displayedAuthors = showAllAuthors ? allAuthors : allAuthors.slice(0, 10);

  return (
    <div className="paper-card">
      <h3><a href={paper.link} target="_blank" rel="noopener noreferrer">{paper.title}</a></h3>
      <p>{paper.summary}</p>

      <small className="authors-container">
        <strong>Authors:</strong> {displayedAuthors.join(", ")}
        {hasMore && (
          <> {" "}
            <button className="author-link-btn" onClick={() => setShowAllAuthors(!showAllAuthors)}>
              {showAllAuthors ? "Show Less" : `and ${allAuthors.length - 10} more`}
            </button>
          </>
        )}
        <span className="source-info">
          | <strong>Source:</strong> {formatSourceName(paper.source)}
          {paper.citations > 0 && <> | <strong>Citations:</strong> {paper.citations}</>}
          {paper.year > 0 && <> | <strong>Year:</strong> {paper.year}</>}
        </span>
      </small>

      <div className="buttons-container">
        {/* The button text now changes based on showRelated state */}
        <button className="related-button" onClick={handleRelatedToggle} disabled={loadingRelated}>
          {loadingRelated ? "Loading..." : showRelated ? "Hide Related Papers" : "See Related Papers"}
        </button>
        <button className="summary-button" onClick={summarizePaper} disabled={loadingSummary}>
          Summarize
        </button>
      </div>

      {loadingSummary && <p className="loading" style={{color: '#4a148c'}}>Summarizing...</p>}
      {summary && <div className="summary-result">{formatSummary(summary)}</div>}
      {loadingRelated && <p className="loading">Finding related...</p>}

      {/* This section ONLY appears when showRelated is true */}
      {showRelated && related.length > 0 && (
        <div className="related-papers-dropdown">
          <h4 style={{marginTop: '15px', borderTop: '1px solid #ddd', paddingTop: '10px'}}>Related Papers:</h4>
          {related.map((r, i) => (
            <div key={i} style={{marginBottom: '10px', paddingLeft: '10px'}}>
              <a href={r.link} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'none', color: '#4a148c'}}>{r.title}</a>
              <p style={{fontSize: '0.8rem', margin: '4px 0'}}>{r.summary.substring(0, 120)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
