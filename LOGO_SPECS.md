# FlexBook Logo Specifications

**Version:** 1.0
**Last Updated:** April 5, 2026
**Status:** Ready for Design

Complete specifications for creating FlexBook logo assets.

---

## Logo Concept

**Theme:** Flex arrow + map pin
- **Flex Arrow:** Curved arrow suggesting movement, flexibility, and spontaneity
- **Map Pin:** Destination, location, travel intent
- **Combined:** Movement toward discovery

---

## Logo Variations

### 1. Primary Logo (Full Lockup)

**Components:**
- Icon (left): Flex arrow + map pin in teal with orange accent
- Text (right): "FlexBook" in Poppins Bold, uppercase-style

**Dimensions:**
- Width: 240px (ideal size for web)
- Height: 60px
- Aspect ratio: 4:1

**Spacing:**
- Margin between icon and text: 16px
- Clear space around logo: 1x height (60px minimum)

**Colors:**
- Icon: Teal (#14A085) with orange accent (#FF9F43)
- Text: Charcoal (#2B2B2B)
- Background: White or transparent

### 2. Icon-Only Logo (Mark)

**Component:**
- Square format: Icon only (flex arrow + map pin)
- Background: Teal (#14A085) or transparent

**Dimensions:**
- Size: 64x64px (standard app icon)
- Minimum: 24px
- Maximum: No limit

**Variations:**
- Solid teal with white icon
- White icon on teal background
- Single color (teal or white)

### 3. Horizontal Logo (Social Media)

**Components:**
- Icon (small, left)
- Text: "FlexBook" horizontally

**Dimensions:**
- Width: 300px
- Height: 60px
- Aspect ratio: 5:1

**Usage:**
- Twitter/X header
- LinkedIn profile
- Website header

### 4. Stacked Logo (Vertical)

**Components:**
- Icon (top, centered)
- Text: "FlexBook" (bottom, centered)

**Dimensions:**
- Width: 120px
- Height: 180px
- Aspect ratio: 2:3

**Usage:**
- App store listings
- Vertical spaces
- Social media squares

---

## Logo Design Guidelines

### Icon Design Details

**Flex Arrow:**
- Curved arrow suggesting movement right/upward
- Stroke width: 3-4px
- Radius: smooth, no sharp angles
- Direction: left-to-right, upward curve

**Map Pin:**
- Classic pin shape (circle + point)
- Integrated with arrow (arrow starts at pin top)
- Size: proportional to arrow

**Color Integration:**
- Primary: Teal (#14A085)
- Accent: Orange (#FF9F43) on arrow or pin point
- Creates visual hierarchy

### Typography Details

**Font:** Poppins Bold (700 weight)
- Letter spacing: +0.5px (slight tracking)
- Case: Sentence case ("FlexBook" not "FLEXBOOK")
- Color: Charcoal (#2B2B2B)

**Sizing:**
- 240px logo: text size ≈ 32px
- Ensure text is readable at small sizes (min 12px)

---

## Color Variations

### 1. Full Color (Preferred)
```
Icon: Teal (#14A085) with orange accent (#FF9F43)
Text: Charcoal (#2B2B2B)
Background: White or transparent
Contrast: AAA ✓
```

### 2. Single Color (Teal)
```
Icon + Text: Teal (#14A085)
Background: White or light background
Contrast: AAA ✓
```

### 3. Single Color (White)
```
Icon + Text: White (#FFFFFF)
Background: Teal (#14A085) or dark background
Contrast: AAA ✓
```

### 4. Grayscale
```
Icon + Text: Medium gray (#666666)
Background: White
Usage: Print, limited color situations
Contrast: AAA ✓
```

---

## Logo Files to Create

```
assets/logos/
├── flexbook-full-lockup.svg           # Full lockup, color
├── flexbook-full-lockup-white.svg     # Full lockup, white
├── flexbook-icon-square.svg           # Icon only, square
├── flexbook-icon-square-white.svg     # Icon only, white
├── flexbook-horizontal.svg            # Horizontal stacked
├── flexbook-vertical.svg              # Vertical stacked
├── flexbook-full-lockup.png           # Raster (300dpi, color)
├── flexbook-icon-192.png              # App icon (192x192)
├── flexbook-icon-512.png              # App icon (512x512)
├── favicon.ico                        # Browser favicon (32x32)
└── favicon-180.png                    # iOS favicon (180x180)
```

---

## Technical Specifications

### SVG Requirements
- Clean, optimized SVG code
- No embedded images
- Paths should be simplified
- Text can be converted to paths or remain as text (prefer paths for consistency)
- Viewbox: Responsive (e.g., `viewBox="0 0 240 60"`)

### PNG Requirements
- 300 DPI for print
- Transparent background (PNG-8 or PNG-24)
- File size: < 50KB
- Color profile: sRGB

### Favicon Requirements
- 32x32 pixels (PNG format)
- Must work at small sizes
- Icon-only version (mark)
- Transparent background

### App Icon Requirements (iOS/Android)
- **192x192px** (Android standard)
- **512x512px** (High-res, app stores)
- **180x180px** (iOS recommended)
- Rounded corners (iOS): 20% radius
- Safe zone: Leave 8px padding inside

---

## Logo Usage Guidelines

### ✅ Do's
- Use provided logo files without modification
- Maintain clear space (1x height minimum)
- Use full-color version on light backgrounds
- Use white version on dark/teal backgrounds
- Scale proportionally (maintain aspect ratio)
- Use high-resolution version (PNG 300dpi) for print

### ❌ Don'ts
- Don't rotate, skew, or distort logo
- Don't change colors or add effects
- Don't use gradient or pattern fill
- Don't place on busy/colored backgrounds without white space
- Don't use below minimum size (24px for icon, 120px for lockup)
- Don't add drop shadows, outlines, or borders
- Don't use logo name or tagline inside logo shape

---

## Logo Placement Examples

### Website Hero
```
Layout: Full lockup (240px+) centered
Background: Off-white (#FAFAF8)
Margin: 64px top/bottom, 24px sides
```

### App Header
```
Layout: Icon-only (48-64px) + "FlexBook" text
Position: Top-left or center
Margin: 12px padding around icon
```

### Social Media Profile
```
Twitter: Horizontal logo (300px)
LinkedIn: Square icon or vertical logo
Instagram: Icon-only (512px)
```

### App Store Listing
```
Icon: 512x512px (icon-only)
Screenshot: Lockup in corner (120px+)
Tagline: Below logo ("Your trip. Your rules. Your price.")
```

### Business Card / Print
```
Corner: Icon-only (12mm)
Or: Full lockup (50mm width)
Color: Full color on white, or teal on cream
```

---

## Design Checklist

Before finalizing logo:

- [ ] Icon is recognizable at 32px
- [ ] Text is readable at 12px
- [ ] Clear space respected in all variations
- [ ] All color variations tested
- [ ] SVG is optimized (< 10KB)
- [ ] PNG is high quality (300dpi if print)
- [ ] Favicon renders clearly
- [ ] App icons have rounded corners (iOS)
- [ ] All file formats created
- [ ] Naming convention consistent
- [ ] Files organized in assets folder
- [ ] Logo looks good on mobile
- [ ] Contrast meets WCAG AAA

---

## Brand Mark Rules

### When to Use Full Lockup
- Websites (desktop + mobile)
- Email signatures
- Presentations
- Large formats (posters, signage)

### When to Use Icon Only
- App icon
- Favicon
- Social media avatars
- Small spaces (< 80px)
- Navigation bar
- Buttons (if needed)

### When to Use Horizontal
- Twitter header
- LinkedIn banner
- Website header
- Wide spaces

### When to Use Vertical
- App store listings
- Mobile headers
- Portrait layouts
- Business cards (vertical)

---

## SVG Template Structure

```xml
<!-- FlexBook Full Lockup SVG Template -->
<svg viewBox="0 0 240 60" xmlns="http://www.w3.org/2000/svg">
  <!-- Icon Group -->
  <g id="icon">
    <!-- Flex Arrow Path -->
    <path d="..." fill="#14A085" stroke="none" />

    <!-- Map Pin Path -->
    <path d="..." fill="#14A085" stroke="none" />

    <!-- Orange Accent -->
    <path d="..." fill="#FF9F43" stroke="none" />
  </g>

  <!-- Text Group -->
  <g id="text">
    <!-- "FlexBook" Text -->
    <text x="68" y="40" font-family="Poppins, sans-serif" font-size="32" font-weight="700" fill="#2B2B2B">
      FlexBook
    </text>
  </g>
</svg>
```

---

## Icon Grid System (Optional)

For precise icon design:
- **Grid size:** 64x64px (for 32px icon, use half)
- **Stroke width:** 2-3px
- **Corner radius:** 8px minimum
- **Padding:** 8px from edge
- **Alignment:** Snap to grid

---

## Logo Animation (Optional)

For interactive use:
- Subtle pulse on hover: opacity 0.95 → 1.0
- Smooth color transition on click: 200ms ease-in-out
- Loading spinner: Rotate arrow 360° over 1.5s

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.95; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.logo:hover {
  animation: pulse 1.5s infinite;
}

.logo.loading {
  animation: spin 1.5s linear infinite;
}
```

---

## Deliverables Checklist

Before launch:

**Vector Files:**
- [ ] `flexbook-full-lockup.svg` (color)
- [ ] `flexbook-full-lockup-white.svg` (white)
- [ ] `flexbook-icon-square.svg` (color)
- [ ] `flexbook-icon-square-white.svg` (white)
- [ ] `flexbook-horizontal.svg`
- [ ] `flexbook-vertical.svg`

**Raster Files (PNG):**
- [ ] `flexbook-full-lockup.png` (300dpi, color)
- [ ] `flexbook-icon-192.png` (192x192)
- [ ] `flexbook-icon-512.png` (512x512)
- [ ] `favicon.ico` (32x32)
- [ ] `favicon-180.png` (iOS, 180x180)

**Documentation:**
- [ ] Logo usage guide (this file)
- [ ] Color palette reference
- [ ] Typography guide
- [ ] Clear space diagram
- [ ] Minimum size specifications

---

**Version:** 1.0 | **Status:** Ready for Design | **Last Updated:** April 5, 2026
