require('dotenv').config();
const { GoogleAuth } = require("google-auth-library");

const express = require("express");
const axios = require("axios");
const natural = require("natural");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let cachedPapers = [];
let topicCache = {};

// ===== API KEYS (replace with your keys) =====
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IEEE_API_KEY = process.env.IEEE_API_KEY;
const SPRINGER_API_KEY = process.env.SPRINGER_API_KEY;
const ELSEVIER_API_KEY = process.env.ELSEVIER_API_KEY;

// ===== Helper Functions =====
async function safeFetch(fn) {
  try { return await fn(); } 
  catch(err) { console.error("API failed:", err.message); return []; }
}

// Normalize sources to prevent duplicates in filters
function normalizeSource(source) {
  if (!source) return "Unknown";
  source = source.toLowerCase();
  if (source.includes("arxiv")) return "arXiv";
  if (source.includes("openalex")) return "OpenAlex";
  if (source.includes("ieee")) return "IEEE";
  if (source.includes("springer")) return "Springer";
  if (source.includes("elsevier")) return "Elsevier";
  if (source.includes("acm")) return "ACM";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

// Assign badges to papers
function assignBadges(p) {
  const badges = [];
  if (p.citations >= 50) badges.push("Highly Cited");
  if (p.source.toLowerCase().includes("arxiv")) badges.push("Open Access");
  const currentYear = new Date().getFullYear();
  if (p.year >= currentYear - 1) badges.push("New");
  return badges;
}

// ===== Fetch from IEEE =====
async function fetchIEEE(topic) {
  if (!IEEE_API_KEY) {
    console.error("IEEE API key not found.");
    return [];
  }

  console.log(`[Backend] Fetching IEEE papers for topic: "${topic}"`);

  return await safeFetch(async () => {
    try {
      const res = await axios.get("https://ieeexploreapi.ieee.org/api/v1/search/articles", {
        params: {
          querytext: topic,
          format: "json",
          max_records: 5,
          start_record: 1,
          apikey: IEEE_API_KEY
        }
      });

      const articles = res.data.articles || [];
      console.log(`[Backend] IEEE Papers fetched: ${articles.length}`);

      return articles.map(p => ({
        title: p.title || "No title",
        summary: p.abstract || "No abstract",
        link: p.pdf_url || "#",
        authors: p.authors?.map(a => a.full_name) || [],
        source: "IEEE",
        year: parseInt(p.publication_year) || 0,
        citations: p.citation_count || 0,
        tags: []
      }));

    } catch (err) {
      console.error("Error fetching IEEE papers:", err.response?.data || err.message);
      return [];
    }
  });
}

// ===== Fetch from Springer =====
const fetchSpringer = async (topic) => {
  try {
    const res = await axios.get("https://api.springernature.com/openaccess/json", {
      params: {
        api_key: SPRINGER_API_KEY,
        q: `keyword:${topic}`,
      }
    });

    console.log("Springer API Raw Response:", res.data);

    const springerPapers = (res.data.records || []).map(p => ({
      title: p.title || "No title",
      summary: p.abstract?.text || "No abstract provided",
      authors: p.creators?.map(a => a.creator) || [],
      source: p.publisher?.text || "Springer",
      link: p.url[0]?.value || "#",
      citations: 0,  // Springer does not provide citation count
      year: parseInt(p.onlineDate?.split("-")[0]) || 0,
      tags: p.subjects || []
    }));

    // console.log(`Mapped Springer Papers Count: ${springerPapers.length}`);
    return springerPapers;

  } catch (error) {
    console.error("Springer API Fetch Error:", error.message);
    return [];
  }
};

// ===== Fetch from Elsevier =====
async function fetchElsevier(topic) {
  if (!ELSEVIER_API_KEY) {
    console.error("Elsevier API key not found.");
    return [];
  }

  console.log("Using Elsevier API Key: Yes");

  try {
    const response = await axios.get(
      'https://api.elsevier.com/content/search/scopus',
      {
        headers: {
          'X-ELS-APIKey': ELSEVIER_API_KEY,
          'Accept': 'application/json' // Request JSON format
        },
        params: {
          query: encodeURIComponent(topic),
          count: 5,
          view: "STANDARD" 
        }
      }
    );

    const entries = response.data['search-results']?.entry || [];

    return entries.map(p => ({
      title: p['dc:title'] || 'No title',
      summary: p['dc:description'] || p['prism:teaser'] || 'No abstract',
      link: p['prism:url'] || '#',
      authors: (p['dc:creator'] ? [p['dc:creator']] : p['author-names']?.author?.map(a => a.authname) || []),
      source: 'Scopus',
      year: parseInt(p['prism:coverDate']?.split('-')[0]) || 0,
      citations: parseInt(p['citedby-count']) || 0,
      tags: p['authkeywords']?.split('|').map(tag => tag.trim()) || []
    }));
  } catch (error) {
    console.error(`Error fetching from Elsevier: ${error.response?.status} - ${error.response?.statusText}`);
    return [];
  }
}

// ===== Main Route: Papers =====
app.get("/papers", async (req,res)=>{
  const topic = req.query.topic || "";
  if (topicCache[topic]) return res.json({ papers: topicCache[topic] });

  // OpenAlex
  const openAlexPapers = await safeFetch(async () => {
    const r = await axios.get(`https://api.openalex.org/works?search=${encodeURIComponent(topic)}&per_page=5`);
    return (r.data.results || []).map(p => ({
      title: p.title || "No title",
      summary: p.abstract || "No abstract",
      link: p.id || "#",
      authors: p.authorships ? p.authorships.map(a => a.author.display_name) : [],
      source: normalizeSource(p.host_venue?.display_name || "OpenAlex"),
      year: p.publication_year || 0,
      citations: p.cited_by_count || 0,
      tags: []
    }));
  });

  // arXiv
  const arxivPapers = await safeFetch(async () => {
    const r = await axios.get(`http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(topic)}&start=0&max_results=5`);
    const data = r.data; 
    const papers = [];
    const regex = /<entry>([\s\S]*?)<\/entry>/g; 
    let match;
    while ((match = regex.exec(data)) !== null) {
      const entry = match[1];
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "No title";
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || "No abstract";
      const link = entry.match(/<id>(.*?)<\/id>/)?.[1]?.trim() || "#";
      const authors = [...entry.matchAll(/<name>(.*?)<\/name>/g)].map(a=>a[1]);
      papers.push({ title, summary, link, authors, source:"arXiv", year:0, citations:0, tags:[] });
    }
    return papers;
  });

  // Semantic Scholar
  const semPapers = await safeFetch(async () => {
    const r = await axios.get(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&limit=5&fields=title,abstract,url,venue,citationCount,year,authors`);
    return (r.data.data || []).map(p => ({
      title: p.title || "No title",
      summary: p.abstract || "No abstract",
      link: p.url || "#",
      authors: p.authors ? p.authors.map(a=>a.name) : [],
      source: normalizeSource(p.venue || "Semantic Scholar"),
      year: p.year || 0,
      citations: p.citationCount || 0,
      tags: []
    }));
  });

  const springerPapers = await fetchSpringer(topic);
  // const elsevierPapers = await fetchElsevier(topic);
  // const ieeePapers = await fetchIEEE(topic);

  // console.log("[Backend] Elsevier Papers fetched:", elsevierPapers.length);
  // console.log("[Backend] IEEE Papers fetched:", ieeePapers.length);

  // Combine all papers
  let allPapers = [
    ...openAlexPapers, 
    ...arxivPapers, 
    ...semPapers, 
    ...springerPapers
    //, ...elsevierPapers,
    // ...ieeePapers,
  ];

  console.log("[Backend] Total Papers aggregated:", allPapers.length);

  // Assign badges
  allPapers = allPapers.map(p => ({ ...p, tags: assignBadges(p) }));

  cachedPapers = allPapers;
  topicCache[topic] = allPapers;

  // Trending sort
  const currentYear = new Date().getFullYear();
  allPapers.sort((a,b)=>{
    const scoreA = Math.log(a.citations+1) + (a.year?(currentYear-a.year)*-0.5:0);
    const scoreB = Math.log(b.citations+1) + (b.year?(currentYear-b.year)*-0.5:0);
    return scoreB - scoreA;
  });

  res.json({ papers: allPapers });
});

// ===== Related Papers – Content-based Recommendation =====
app.get("/related", (req,res)=>{
  const index = parseInt(req.query.index);
  if (!cachedPapers || !cachedPapers[index]) return res.status(404).json({ error:"Paper not found" });

  const clickedPaper = cachedPapers[index];
  const clickedText = (clickedPaper.title + " " + clickedPaper.summary).toLowerCase();

  const TfIdf = natural.TfIdf;
  const tfidf = new TfIdf();
  cachedPapers.forEach(p => tfidf.addDocument((p.title + " " + p.summary).toLowerCase()));

  const scores = cachedPapers.map((p,i)=>{
    if(i===index) return { paper:p, score:-1 };
    return { paper:p, score:tfidf.tfidf(clickedText,i) };
  });

  const relatedPapers = scores
    .filter(s => s.score > 0)
    .sort((a,b)=>b.score - a.score)
    .slice(0,5)
    .map(r => r.paper);

  res.json({ clickedPaper, relatedPapers });
});

// ===== Summarize Paper =====
app.post("/summarize", async (req, res) => {
  const { title, summary, authors, year } = req.body; // authors should be an array

  if (!title || !summary) {
    return res.status(400).json({ error: "Title and summary are required." });
  }

  // Construct prompt dynamically
  let prompt = `Summarize this academic paper in a single concise paragraph (5-10 lines). Only use the provided abstract if available; otherwise, infer from the title and authors.

  Title: "${title}"
  Authors: "${Array.isArray(authors) ? authors.join(", ") : authors || "Unknown"}"
  Year: "${year || "Unknown"}"
  ${summary && summary.trim() !== "" ? `Abstract: "${summary}"` : ""}

  Important instructions:
- Return only one cohesive paragraph.
- Do NOT include any bullet points, lists, headings, or enumerations.
- Do not include introductory phrases like "Given the title..." or "Based on the title...".
- Do not invent content unrelated to the title and abstract.
- Provide a clear, direct, and scientifically plausible summary.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      body,
      { headers: { "Content-Type": "application/json" } }
    );

    // Get the generated text from Gemini API
    let generatedSummary = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";

    // Remove everything before the first colon or instruction preamble
    generatedSummary = generatedSummary.replace(/^.*?:\s*/s, '').trim();

    // Replace newlines and bullet points with spaces to make it a clean paragraph
    generatedSummary = generatedSummary.replace(/[\n*•]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Send the cleaned summary back to the client
    res.json({
      summary: generatedSummary,
      authors: authors || [],
      year: year || null,
    });

  } catch (err) {
    console.error("Gemini API Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to generate summary!" });
  }
});

// ===== Server Start =====
app.listen(PORT, ()=>console.log(`Research server running at http://localhost:${PORT}`));
