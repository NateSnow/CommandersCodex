/**
 * Image loading utility for card images from Scryfall CDN.
 *
 * Creates `<img>` elements with Scryfall CDN URLs and provides
 * fallback placeholders when images fail to load.
 */

import type { Card } from "../models/card.js";

/** Available image size options corresponding to Scryfall image URIs. */
export type ImageSize = "small" | "normal" | "large";

/**
 * Creates an `<img>` element for a card using its Scryfall CDN image URI.
 *
 * If the card has no image URI for the requested size, or if the image
 * fails to load, a placeholder `<div>` showing the card name is returned
 * (or replaces the broken image).
 *
 * @param card - The card to render an image for.
 * @param size - The image size: 'small', 'normal', or 'large'.
 * @returns An HTMLElement — either an `<img>` or a placeholder `<div>`.
 */
export function createCardImage(card: Card, size: ImageSize = "normal"): HTMLElement {
  const imageUri = getImageUri(card, size);

  if (!imageUri) {
    return createPlaceholder(card.name);
  }

  const img = document.createElement("img");
  img.src = imageUri;
  img.alt = card.name;
  img.loading = "lazy";

  // On load failure, replace with a placeholder
  img.addEventListener("error", () => {
    const placeholder = createPlaceholder(card.name);
    img.replaceWith(placeholder);
  });

  return img;
}

/**
 * Resolves the image URI for a given card and size.
 *
 * For double-faced cards without top-level image URIs, falls back to
 * the front face's image URIs.
 */
function getImageUri(card: Card, size: ImageSize): string | undefined {
  // Try top-level image URIs first
  if (card.imageUris) {
    return card.imageUris[size];
  }

  // Fall back to front face for double-faced cards
  if (card.cardFaces && card.cardFaces.length > 0) {
    const frontFace = card.cardFaces[0];
    if (frontFace.imageUris) {
      return frontFace.imageUris[size];
    }
  }

  return undefined;
}

/**
 * Creates a placeholder `<div>` element displaying the card name.
 *
 * Used when no image URI is available or when an image fails to load.
 */
function createPlaceholder(cardName: string): HTMLDivElement {
  const placeholder = document.createElement("div");
  placeholder.className = "card-image-placeholder";
  placeholder.textContent = cardName;
  placeholder.setAttribute("role", "img");
  placeholder.setAttribute("aria-label", cardName);

  // Inline styles for the placeholder so it works in any context
  placeholder.style.display = "flex";
  placeholder.style.alignItems = "center";
  placeholder.style.justifyContent = "center";
  placeholder.style.textAlign = "center";
  placeholder.style.backgroundColor = "#333";
  placeholder.style.color = "#aaa";
  placeholder.style.fontSize = "0.8rem";
  placeholder.style.padding = "8px";
  placeholder.style.borderRadius = "4px";
  placeholder.style.width = "100%";
  placeholder.style.aspectRatio = "488 / 680";

  return placeholder;
}
