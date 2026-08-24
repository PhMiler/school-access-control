# Revert Palette to Blue

## Objective
Revert the color palette from purple back to the original blue institutional theme.

## What changed
The current palette uses purple hues (HSL 260-262 range). The original blue palette used HSL 217-222 range for a clean institutional blue + white + red look.

## Plan
1. Restore `src/index.css` to the original blue palette from the pre-purple version (`e4fda2e`):
   - Primary: blue `hsl(217 91% 35%)`
   - Gradients: blue tones
   - Sidebar: dark blue `hsl(217 91% 22%)`
   - Dark mode: blue-tinted grays
   - Hero gradient: blue to red (institutional)
   - All shadows, borders, and accents aligned with blue
2. The `tailwind.config.ts` does not need changes because it references CSS variables only.
