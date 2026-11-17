---
version: alpha
colors:
  primary: "#A345FF"
  portal-black: "#0B0B0D"
  portal-surface: "#151519"
  portal-wine: "#6B1022"
  canvas: "#F7F9FC"
  graphite: "#0F172A"
  success: "#10B981"
  violet: "#4F46E5"
  violet-deep: "#32135E"
  border: "#D8E0EC"
typography:
  display:
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif"
  body:
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif"
rounded:
  control: "10px"
  surface: "16px"
spacing:
  gutter: "32px"
  compact: "12px"
  section: "32px"
components:
  button:
    rounded: "10px"
  input:
    rounded: "10px"
  appRail:
    backgroundColor: "#0B0B0D"
---

## Overview

ASEX Business is a product-first workspace for Brazilian entrepreneurs. The portal is a dark, central launcher: a graphite field with a restrained wine-red horizon and three deliberate application surfaces. PRECIFICA+ remains a separate calculation workspace with its own violet identity.

PROPOSTA+ is the commercial-document workspace: an operational navy rail and a true-white work surface designed for preparing a proposal beside its monetary total. Its signature is the document-like reading rhythm — restrained rules, clear table columns and one cobalt action — rather than decorative financial dashboards.

## Colors

The hub canvas is graphite-black. Its only atmospheric gesture is a deep wine-red gradient confined to the lower page; violet identifies the active PRECIFICA+ card. Green indicates completed or positive states only. Do not add glow, glass effects, or fictitious financial signals.

For PROPOSTA+, `--asex-navy` is the navigation and document-identity color, `--asex-blue` is the sole primary action and focus family, and true white is the working surface. Neutral gray separates data without making the editor look like a stack of cards. Status color is semantic only: blue for sent, green for approved, red for declined/cancelled and amber for expired.

## Typography

Use Geist or Inter with strong, uncompressed headings and practical labels. Forms and numeric results must remain legible at a 16px baseline on phones.

## Layout

The portal is an intentional centered launcher with a simple header, centered headline and one row of three square cards. At narrow widths cards stack vertically; the header becomes compact. The independent calculator retains its two-column work layout.

## Elevation & Depth

Surfaces are mostly flat. A subtle shadow is permitted only on primary work areas and never substitutes for hierarchy.

## Shapes

Controls are softly rounded; rows, dividers, and careful spacing carry most organization. Avoid pill-heavy UI.

## Components

Buttons, fields, form errors, and feedback share the primitives in `packages/ui`. Native number inputs are intentionally used for the calculator because the browser's numeric semantics and keyboard are appropriate to this first-phase form.

PROPOSTA+ reuses those native field semantics and defines its app-specific table/editor layout in `apps/proposta-plus/app/proposta.css`. Its runtime color path is `DESIGN.md colors.primary → --asex-blue → --proposal-blue → .primary`; the existing package stylesheet remains the canonical source for shared controls.

## Do's and Don'ts

Do make the calculation assumptions visible and distinguish user-entered values from results. Do preserve space for inline validation. Do not show invented financial metrics, use browser dialogs, or claim tax advice.
