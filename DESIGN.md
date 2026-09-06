# 成都猫狗小院 · DESIGN.md

## Design read
Reading this as: a trust-first community adoption website for Chengdu residents, with a calm, warm, photo-led language, leaning toward editorial storytelling plus an approachable operations dashboard.

## Visual world
- Metaphor: a sunlit courtyard noticeboard — paper warmth, clear wayfinding, real animal stories.
- Audience scene: someone browsing on a phone after seeing a shared link, often with only a few seconds to decide whether the page feels genuine and easy to understand.
- First surface must prove: these animals are real, their information is cared for, and contacting the rescue center is simple.

## Palette
- Ink: #2d302a
- Muted ink: #6f7368
- Cream canvas: #fbf8ef
- Warm yellow: #f4c96b
- Pale yellow: #fff0c8
- Sage accent: #78907a
- Clay accent: #c97758
- Line: rgba(45, 48, 42, .12)
- Surface: #ffffff

## Typography
- Display: Fraunces, Georgia, serif fallback; soft editorial character without looking childish.
- UI/body: Manrope, Arial, sans-serif fallback; open and readable.
- Use readable Chinese fallback stack before Latin display faces where text is Chinese-heavy.

## Composition
- Wide, airy single-column site with asymmetrical hero: copy left, featured rescue card right.
- Pet archive uses responsive cards with strong media and compact facts.
- Avoid generic three-card marketing grids; use a warm narrative flow and clear utility controls.
- Admin screen uses an efficient split-pane/table-like composition, not the public storytelling layout.

## Interaction
- One authored moment: hero image and supporting note lift into place on page load.
- Hover states are subtle and tactile: image scale, border tint, button fill.
- Motion respects prefers-reduced-motion.
- Modals are reserved for focused pet details and forms; they must close with Escape and retain keyboard focus.

## Accessibility
- Body text and controls meet readable contrast.
- All photos have meaningful alt text.
- Filter controls expose selected state.
- Form labels are visible and errors are clear.
- Touch targets are at least 44px.
