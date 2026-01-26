#!/usr/bin/env node

/**
 * Art of the Mix Importer
 *
 * Fetches all mixes from artofthemix.org and creates JSON files
 * for the mixtapes content collection.
 *
 * Usage: node scripts/import-artofthemix.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMBER_ID = '3942';
const BASE_URL = 'https://www.artofthemix.org';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'content', 'mixtapes');
const DELAY_MS = 1000; // Delay between requests to be respectful

// Helper to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to slugify titles for filenames
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// Parse date from "M/D/YYYY" to "YYYY-MM-DD"
function parseDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Fetch a page and return HTML
async function fetchPage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

// Extract mix IDs from a list page
function extractMixIds(html) {
  const mixIds = [];
  const regex = /\/mix\/(\d+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (!mixIds.includes(match[1])) {
      mixIds.push(match[1]);
    }
  }
  return mixIds;
}

// Extract mix data from an individual mix page
function extractMixData(html, mixId) {
  const data = {
    id: mixId,
    title: '',
    date: '',
    format: 'cd',
    notes: '',
    tracks: [],
    sideA: null,
    sideB: null
  };

  // Normalize HTML - remove newlines within tags for easier parsing
  const normalizedHtml = html.replace(/>\s+</g, '><').replace(/\n/g, ' ');

  // Extract title - look for the main heading or title tag
  const titleMatch = normalizedHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     normalizedHtml.match(/<title>([^<|]+)/i) ||
                     normalizedHtml.match(/class="?mix-title"?[^>]*>([^<]+)</i);
  if (titleMatch) {
    // Clean up the title - remove " by natalyesaurus" suffix
    data.title = titleMatch[1]
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s+by\s+natalyesaurus\.?$/i, '');
  }

  // Extract date - look for "Submit Date:" specifically
  const dateMatch = html.match(/Submit\s*Date[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
                    html.match(/Submitted[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dateMatch) {
    data.date = parseDate(dateMatch[1]);
  }

  // Extract format - CD, Cassette, or Playlist
  const formatMatch = html.match(/Format[:\s]*(CD|Cassette|Playlist)/i);
  if (formatMatch) {
    data.format = formatMatch[1].toLowerCase();
  }

  // Extract notes/dedication - look for "for [name]" patterns
  const dedicationMatch = html.match(/;\s*for\s+([a-z][a-z\s.]+?)(?:\.|<|$)/i) ||
                          html.match(/dedicated?\s+(?:to\s+)?([a-z][a-z\s.]+?)(?:\.|<|$)/i);
  if (dedicationMatch) {
    data.notes = `for ${dedicationMatch[1].trim().toLowerCase()}`;
  }

  // Check if this is a cassette with sides
  const hasSideA = /Side\s*A/i.test(html);
  const hasSideB = /Side\s*B/i.test(html);
  const isCassette = data.format === 'cassette' || (hasSideA && hasSideB);

  if (isCassette && hasSideA && hasSideB) {
    data.format = 'cassette';

    // Split HTML at "Side B" to parse each side separately
    const sideBIndex = html.search(/Side\s*B/i);
    const sideAHtml = html.substring(0, sideBIndex);
    const sideBHtml = html.substring(sideBIndex);

    // Extract Side A tracks
    data.sideA = extractTracksFromHtml(sideAHtml);
    // Extract Side B tracks
    data.sideB = extractTracksFromHtml(sideBHtml);
    // Combined tracks for backwards compatibility
    data.tracks = [...data.sideA, ...data.sideB];
  } else {
    // Extract tracks normally for CDs
    data.tracks = extractTracksFromHtml(normalizedHtml);
  }

  return data;
}

// Helper function to extract tracks from HTML
function extractTracksFromHtml(html) {
  const tracks = [];
  const normalizedHtml = html.replace(/>\s+</g, '><').replace(/\n/g, ' ');

  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(normalizedHtml)) !== null) {
    let artist = rowMatch[1].replace(/<[^>]+>/g, '').trim();
    let song = rowMatch[2].replace(/<[^>]+>/g, '').trim();

    // Skip header rows
    if (artist.toLowerCase() === 'artist' || song.toLowerCase() === 'song') {
      continue;
    }

    // Skip empty rows
    if (!artist || !song) {
      continue;
    }

    tracks.push({
      title: song.toLowerCase(),
      artist: artist.toLowerCase()
    });
  }

  // Fallback: try list items if no table rows found
  if (tracks.length === 0) {
    const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let listMatch;
    while ((listMatch = listItemRegex.exec(normalizedHtml)) !== null) {
      const item = listMatch[1].replace(/<[^>]+>/g, '').trim();
      const trackMatch = item.match(/^(.+?)\s*[-–—]\s*[""]?(.+?)[""]?$/);
      if (trackMatch) {
        tracks.push({
          title: trackMatch[2].trim().toLowerCase(),
          artist: trackMatch[1].trim().toLowerCase()
        });
      }
    }
  }

  return tracks;
}

// Create JSON file for a mix
function createMixFile(mixData) {
  const slug = slugify(mixData.title);
  const filePath = path.join(OUTPUT_DIR, `${slug}.json`);

  const jsonData = {
    title: mixData.title.toLowerCase(),
    date: mixData.date,
    format: mixData.format,
    notes: mixData.notes,
    artOfTheMixUrl: `https://www.artofthemix.org/mix/${mixData.id}`,
    tracks: mixData.tracks
  };

  // Add side data for cassettes
  if (mixData.format === 'cassette' && mixData.sideA && mixData.sideB) {
    jsonData.sideA = mixData.sideA;
    jsonData.sideB = mixData.sideB;
  }

  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2) + '\n');
  const formatLabel = mixData.format === 'cassette' ? 'cassette' : 'cd';
  console.log(`  Created: ${slug}.json (${mixData.tracks.length} tracks, ${formatLabel})`);
  return true;
}

// Get total page count
async function getTotalPages() {
  const html = await fetchPage(`${BASE_URL}/members/${MEMBER_ID}/mixes/1`);
  const pageMatch = html.match(/mixes\/(\d+)[^>]*>\s*(?:»|last|\d+)\s*<\/a>\s*$/i) ||
                    html.match(/mixes\/(\d+)/g);
  if (pageMatch) {
    const pages = pageMatch.map(m => parseInt(m.match(/\d+$/)[0]));
    return Math.max(...pages);
  }
  return 44; // Default based on known count
}

// Main import function
async function importMixes() {
  console.log('Art of the Mix Importer');
  console.log('=======================\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Step 1: Collect all mix IDs
  console.log('Step 1: Collecting mix IDs from list pages...\n');

  const totalPages = 44; // Known page count
  const allMixIds = [];

  for (let page = 1; page <= totalPages; page++) {
    process.stdout.write(`  Fetching page ${page}/${totalPages}...`);
    try {
      const html = await fetchPage(`${BASE_URL}/members/${MEMBER_ID}/mixes/${page}`);
      const ids = extractMixIds(html);
      allMixIds.push(...ids);
      console.log(` found ${ids.length} mixes`);
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }
    await delay(DELAY_MS);
  }

  console.log(`\nTotal mix IDs collected: ${allMixIds.length}\n`);

  // Step 2: Fetch each mix and create JSON files
  console.log('Step 2: Fetching individual mixes and creating files...\n');

  let created = 0;
  let errors = 0;

  for (let i = 0; i < allMixIds.length; i++) {
    const mixId = allMixIds[i];
    process.stdout.write(`[${i + 1}/${allMixIds.length}] Fetching mix ${mixId}...`);

    try {
      const html = await fetchPage(`${BASE_URL}/mix/${mixId}`);
      const mixData = extractMixData(html, mixId);

      if (mixData.title && mixData.tracks.length > 0) {
        console.log(` "${mixData.title.substring(0, 40)}..."`);
        createMixFile(mixData);
        created++;
      } else {
        console.log(' WARN: Could not parse mix data');
        errors++;
      }
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
      errors++;
    }

    await delay(DELAY_MS);
  }

  // Summary
  console.log('\n=======================');
  console.log('Import Complete!');
  console.log(`  Updated: ${created}`);
  console.log(`  Errors:  ${errors}`);
}

// Run the importer
importMixes().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
