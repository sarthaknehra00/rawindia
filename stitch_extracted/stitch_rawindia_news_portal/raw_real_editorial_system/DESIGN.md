---
name: Raw & Real Editorial System
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#4c4546'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#ab2c5d'
  on-secondary: '#ffffff'
  secondary-container: '#fd6c9c'
  on-secondary-container: '#6e0034'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#ffd9e1'
  secondary-fixed-dim: '#ffb1c5'
  on-secondary-fixed: '#3f001b'
  on-secondary-fixed-variant: '#8b0e45'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
  body-md:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Archivo Narrow
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  meta:
    fontFamily: Work Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1'
spacing:
  margin-desktop: 40px
  margin-mobile: 16px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 64px
---

## Brand & Style

The brand personality is **unfiltered, authoritative, and clinical**. It seeks to bridge the gap between the tactile, high-trust heritage of 20th-century broadsheets and the rapid-fire consumption of modern digital news. The emotional response should be one of "brutal honesty"—cutting through the noise with high-contrast visuals and an uncompromising layout.

The design style is a hybrid of **Modern Minimalism and Editorial Brutalism**. It prioritizes information density and structural clarity. By utilizing sharp borders, a restricted palette, and massive typography, the UI becomes a background vessel for "the raw truth." There is no room for decorative gradients or soft shadows; every line serves to divide or highlight content.

## Colors

The palette is rooted in an off-white base (`#FCFAF7`) to reduce eye strain while maintaining a vintage paper feel. 

- **Primary Black:** Used for all body text and primary headlines to ensure maximum readability and a "printed" feel.
- **Signature Accent:** A striking pink (`#F06292`) used sparingly for interactive elements, highlights, and specific "Opinion" tagging to differentiate subjective content from hard news.
- **Content Tags:** Each content pillar has a dedicated functional color. **NEWS** remains strictly monochrome (Black/White). **GROUND REPORT** uses a high-alert red. **ANALYSIS** uses a deep intellectual green. **PULSE** uses an energetic blue.

## Typography

The system uses a classic "Serif for Headlines, Sans for Body" pairing. 

- **Libre Caslon Text** provides the authoritative, newspaper-esque weight required for headlines. It should be set with tight leading and slight negative letter-spacing for large display sizes.
- **Work Sans** is used for body copy. Its neutral, optimized-for-screen geometry ensures clarity even on low-bandwidth 4G connections.
- **Archivo Narrow** is the "utility" font, used for tags, navigation, and labels. Its condensed nature allows for high-impact categorization without consuming horizontal real estate.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid Grid**. On desktop, the system utilizes a 12-column grid with a maximum content width of 1280px. On mobile, it collapses to a single column with 16px side margins.

Spacing is governed by a strict "Rule of Lines." Instead of using heavy padding or whitespace to separate sections, the system uses 1px or 2px black borders. This maximizes content density, mimicking a physical news sheet. Elements should be "stacked" with vertical rhythm: Labels are placed 8px above headlines, and headlines 16px above lead paragraphs.

## Elevation & Depth

This design system rejects depth. There are **zero shadows** and **zero blurs**. 

Hierarchy is established entirely through **Tonal Layering and Bold Borders**.
- **Level 0:** The base background (`#FCFAF7`).
- **Level 1:** Inset containers or panels defined by a `1px solid #000000` border.
- **Emphasis:** High-priority "Breaking" or "Pulse" sections may use a solid black background with white text to invert the hierarchy and command immediate attention.
- **Interactives:** Buttons and hover states use solid color fills (no gradients) to indicate state changes.

## Shapes

The shape language is **strictly geometric and sharp**. Rounded corners are prohibited to maintain the "Raw" and "Unfiltered" brand sentiment. Every container, button, and image crop must have a 0px border radius. This architectural rigidity reinforces the portal's serious, journalistic tone.

## Components

### Content Tags
The signature component. Tags are styled using **Archivo Narrow** in all-caps. They feature a `1px` border or a solid background fill depending on the category. For example, "GROUND REPORT" is always white text on a solid red block, while "NEWS" is black text in a thin black-bordered box.

### Headlines & Lead-ins
Headlines are never truncated. The system must allow for long-form titles. The "Lead-in" or "Standfirst" text follows the headline in a slightly larger `body-md` size to provide immediate context.

### Buttons
Buttons are rectangular blocks. The primary "Action" button is solid black with white text. The secondary button is an outline (Ghost) style. Hover states involve a full-color fill of the signature pink or the specific category color.

### Media Blocks
Images are strictly rectangular. Captions are placed directly beneath the image in `meta` italics, separated by a thin horizontal rule. Black and white photography is encouraged for "Ground Report" features to enhance the "Raw" aesthetic.

### Rules & Dividers
Horizontal rules (`<hr>`) are used extensively to separate articles in list views. Use `1px solid #000` for standard separation and `3px solid #000` to denote the end of a major section or a "Lead Story" block.