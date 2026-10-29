---
description: How to set up and run ToolPhoto2025 project
---

# ToolPhoto2025 Project Workflow

This workflow covers setting up, running, and building the ToolPhoto2025 project - an AI Studio application for photo generation.

## Prerequisites

- **Node.js** (v18+ recommended)
- **Git** (for version control)
- **Gemini API Key** (for AI features)

## Setup Steps

### 1. Install Dependencies
// turbo
```bash
npm install
```

### 2. Configure Environment
Create or update `.env.local` file with your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

## Running the Application

### Development Mode (Web)
// turbo
```bash
npm run dev
```
This starts the Vite dev server at `http://localhost:3000`

### Development Mode (Electron)
```bash
npm run electron:dev
```
This starts both Vite dev server and Electron app concurrently.

## Building the Application

### Build Web Version
```bash
npm run build
```

### Build Windows Electron Installer
```bash
npm run electron:build:win
```
Output will be in the `release/` directory.

### Preview Production Build
```bash
npm run preview
```

## Project Structure

- **App.tsx** - Main application component
- **components/** - React UI components (39 components)
- **services/** - Backend services (AI, Firebase, Antigravity, etc.)
- **hooks/** - Custom React hooks
- **electron/** - Electron main process files
- **types/** - TypeScript type definitions
- **public/** - Static assets

## Key Services

- **aiService.ts** - AI generation logic
- **antigravityService.ts** - Antigravity Manager integration
- **firebase.ts** - Firebase configuration
- **imagegenService.ts** - Image generation service

## Publish/Update
```bash
npm run update
```
This runs the `publish.ps1` PowerShell script to publish a new release to GitHub.
