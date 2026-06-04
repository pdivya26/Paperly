# Paperly

Explore academic papers smartly — search by topic, keyword, or upload a PDF to discover related research papers across multiple sources.

🔗 **[Live Demo](https://paperly-web.vercel.app/)**

## Features

- **Topic-Based Search** – Search papers using topics, keywords, or paper titles
- **File-Based Search** – Upload a research paper (PDF) to extract metadata and find related papers
- **Multi-Source Integration** – Fetches papers from arXiv, OpenAlex, Semantic Scholar, Springer, and IEEE
- **Advanced Filtering & Sorting** – Filter by source; sort by relevance, date, citations, or title
- **AI-Powered Summaries** – Generate concise summaries using Groq (Llama 3)
- **Related Papers Discovery** – TF-IDF based content similarity to find connected research
- **Responsive UI** – Optimized for both desktop and mobile

## Tech Stack

| Layer     | Technology                                                        |
|-----------|-------------------------------------------------------------------|
| Frontend  | React                                                             |
| Backend   | Node.js, Express                                                  |
| AI        | Groq API — `llama-3.3-70b-versatile` (summarization & PDF parsing) |
| Data      | arXiv API, OpenAlex API, Semantic Scholar API, Springer Nature API, IEEE Xplore API |

No database — all data is fetched live from external APIs and cached in memory per session.

## Project Structure

```
paperly/
├── client/               # React frontend
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── App.css
│       └── index.js
├── server.js             # Express backend
├── package.json          # Backend dependencies
└── .gitignore
```

---

## Setup Instructions

### Prerequisites

- Node.js v18+
- npm
- API keys (see below)

### Installation

```bash
git clone https://github.com/pdivya26/Paperly.git
cd Paperly
```

### Backend Setup

Install backend dependencies from the root:

```bash
npm install
```

Create a `.env` file in the root directory:

```env
GROQ_API_KEY=your_groq_api_key
IEEE_API_KEY=your_ieee_api_key
SPRINGER_API_KEY=your_springer_api_key
PORT=5000
```

Start the backend server:

```bash
node server.js
```

### Frontend Setup

```bash
cd client
npm install
```

Create a `.env` file inside the `client` directory:

```env
REACT_APP_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm start
```

App runs at `http://localhost:3000`.

---

**Root (`.env`) — Backend**

| Variable           | Description                                       | Required |
|--------------------|---------------------------------------------------|----------|
| `GROQ_API_KEY`     | Groq API key for AI summarization and PDF parsing | ✅ Yes   |
| `IEEE_API_KEY`     | IEEE Xplore API key                               | ✅ Yes   |
| `SPRINGER_API_KEY` | Springer Nature API key                           | ✅ Yes   |
| `PORT`             | Port for the Express server (default: 5000)       | Optional |

**`client/.env` — Frontend**

| Variable            | Description                        | Required |
|---------------------|------------------------------------|----------|
| `REACT_APP_API_URL` | URL pointing to the backend server | ✅ Yes   |

### Where to get the API keys

| API              | Link                                                               | Notes                              |
|------------------|--------------------------------------------------------------------|------------------------------------|
| Groq             | [console.groq.com](https://console.groq.com)                       | Free tier available                |
| IEEE Xplore      | [developer.ieee.org](https://developer.ieee.org)                   | Requires registration & approval   |
| Springer Nature  | [dev.springernature.com](https://dev.springernature.com)           | Free for open access               |
| arXiv            | No key needed                                                      | Free public API                    |
| OpenAlex         | No key needed                                                      | Free public API                    |
| Semantic Scholar | No key needed                                                      | Free public API                    |

## Implementation Screenshots

<img width="1919" height="969" alt="PPL1" src="https://github.com/user-attachments/assets/111a6d81-5de0-4634-8843-dec93ed31de9" />

<img width="1918" height="967" alt="PPL2" src="https://github.com/user-attachments/assets/817863ff-725c-403c-934b-3472dfc86b76" />

<img width="1919" height="965" alt="PPL3" src="https://github.com/user-attachments/assets/22aceac8-1b02-4e88-b7c9-4195badd887d" />

<img width="1919" height="966" alt="PPL4" src="https://github.com/user-attachments/assets/25fdbf88-f00f-4320-acf9-b16c9b7989bf" />

<img width="1919" height="970" alt="PPL5" src="https://github.com/user-attachments/assets/6710f201-9e65-4320-a447-d5dd9ab4b882" />

<img width="1919" height="966" alt="PPL6" src="https://github.com/user-attachments/assets/30125636-10f3-4c11-817b-5eb731c87a10" />

## Legal

© 2025 Divya Poojari. All rights reserved.  
This project and its source code are protected under copyright law. Viewing the source is permitted, but copying, modifying, distributing, or using any part of this code without explicit written permission from the author is strictly prohibited.

## Note

Paperly does not host or distribute any copyrighted PDFs. It only aggregates publicly available metadata and abstracts, and redirects users to the respective publication websites.
