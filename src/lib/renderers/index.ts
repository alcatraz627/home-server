/**
 * Document Renderer Registry
 *
 * Modular system for rendering different file types in the browser.
 * Each renderer handles a set of MIME types and produces an HTML string
 * or a DOM-ready result from raw file data.
 *
 * To add a new renderer:
 * 1. Create a new file in this directory implementing DocumentRenderer
 * 2. Register it in the RENDERERS array below
 */

export interface RenderResultHtml {
  type: 'html';
  content: string;
}

export interface RenderResultText {
  type: 'text';
  content: string;
}

export interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface RenderResultData {
  type: 'data';
  sheets: SheetData[];
}

export type RenderResult = RenderResultHtml | RenderResultText | RenderResultData;

export interface DocumentRenderer {
  /** Unique name for this renderer */
  name: string;
  /** MIME types or extensions this renderer handles */
  canRender: (mime: string, filename: string) => boolean;
  /** Render raw file data into displayable content */
  render: (data: ArrayBuffer, filename: string) => Promise<RenderResult>;
}

// Import renderers
import { excelRenderer } from './excel';
import { wordRenderer } from './word';
import { epubRenderer } from './epub';
import { markdownRenderer } from './markdown';
import { jsonRenderer } from './json';
import { textRenderer } from './text';

/**
 * Renderer registry — order matters: first match wins.
 * More specific renderers should come before generic ones.
 */
const RENDERERS: DocumentRenderer[] = [
  excelRenderer,
  wordRenderer,
  epubRenderer,
  markdownRenderer,
  jsonRenderer,
  textRenderer, // catch-all for text/* types
];

/** Find the best renderer for a given file */
export function getRenderer(mime: string, filename: string): DocumentRenderer | null {
  return RENDERERS.find((r) => r.canRender(mime, filename)) || null;
}

/** Check if any renderer can handle this file */
export function hasRenderer(mime: string, filename: string): boolean {
  return RENDERERS.some((r) => r.canRender(mime, filename));
}

/** Render a file's data using the appropriate renderer */
export async function renderDocument(data: ArrayBuffer, mime: string, filename: string): Promise<RenderResult | null> {
  const renderer = getRenderer(mime, filename);
  if (!renderer) return null;
  return renderer.render(data, filename);
}
