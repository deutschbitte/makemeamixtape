#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIXTAPES_DIR = path.join(__dirname, '..', 'src', 'content', 'mixtapes');

const files = fs.readdirSync(MIXTAPES_DIR).filter(f => f.endsWith('.json'));

let updated = 0;

for (const file of files) {
  const filePath = path.join(MIXTAPES_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    const data = JSON.parse(content);

    // Helper to clean track array
    const cleanTracks = (tracks) => tracks.map(track => ({
      title: track.title.replace(/&nbsp;/g, '').trim(),
      artist: track.artist.replace(/&nbsp;/g, '').trim()
    }));

    // Clean up tracks
    if (data.tracks) {
      data.tracks = cleanTracks(data.tracks);
    }

    // Clean up sideA and sideB for cassettes
    if (data.sideA) {
      data.sideA = cleanTracks(data.sideA);
    }
    if (data.sideB) {
      data.sideB = cleanTracks(data.sideB);
    }

    // Clean up title
    if (data.title) {
      data.title = data.title.replace(/&nbsp;/g, '').trim();
    }

    // Write back with proper formatting
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    updated++;
  } catch (err) {
    console.log(`Error processing ${file}: ${err.message}`);
  }
}

console.log(`Reformatted ${updated} files`);
