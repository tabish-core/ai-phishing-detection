# CaughtIn4K

## Project Overview

CaughtIn4K is a web-based cybersecurity application designed to detect potentially phishing websites.

The system analyzes multiple characteristics of a submitted website, including:

* URL characteristics
* Webpage characteristics
* Natural Language Processing (NLP) features
* Visual/page structure features

These features are combined to produce an overall phishing risk assessment.

## Core Objective

Provide a simple and understandable interface where a user can submit a website URL and receive an AI-assisted phishing risk assessment.

## Technology Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Framer Motion
* Lucide React

### Backend

* Python
* FastAPI

### Storage

No database is required for the initial implementation.

## Detection Pipeline

The planned analysis pipeline is:

1. URL Analysis
2. Webpage Analysis
3. NLP Analysis
4. Visual Analysis
5. Risk Scoring
6. Result Visualization

## Important Development Rules

* Keep the project simple and understandable.
* Do not introduce unnecessary frameworks or libraries.
* Do not add authentication.
* Do not add a database unless explicitly required later.
* Do not add Docker.
* Do not build unnecessary admin panels.
* Do not create unnecessary pages.
* Prioritize functionality and visual quality.
* The application should look like a professional cybersecurity product rather than a generic student dashboard.

## UI Direction

The interface should feel modern, premium, technical, and trustworthy.

Avoid:

* Excessive neon colors
* Hacker-style fonts
* Excessive glowing effects
* Generic cybersecurity dashboard layouts
* Overly complicated charts
* Visual clutter

Use:

* Strong typography
* Clean spacing
* Subtle motion
* Meaningful animations
* Clear risk visualization
* Interactive analysis states
* Professional iconography

## Main User Flow

User opens CaughtIn4K.

↓

User enters a URL.

↓

User starts a scan.

↓

The interface displays the analysis pipeline:

URL → WEBPAGE → NLP → VISION → RISK

↓

The system analyzes the submitted website.

↓

The application displays:

* Overall risk score
* Risk level
* URL findings
* Webpage findings
* NLP findings
* Visual findings
* Explanation of detected issues

## Development Strategy

The project will be developed incrementally.

Do not implement the entire application in one iteration.

Each iteration should produce a working improvement without unnecessarily modifying unrelated parts of the project.
