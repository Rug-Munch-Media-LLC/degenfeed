# Design System — Agent Contract

## How AI Agents Use This

When building any UI component for DegenFeed:

1. **Colors**: Always use design tokens, not hardcoded hex values
   - `var(--color-degen-500)` not `#00ff41`
   - Protocol colors from token map: `PROTOCOL_COLORS[protocol]`

2. **Spacing**: Use Tailwind spacing scale (0.25rem increments)
   - `p-4` not `padding: 16px`

3. **Typography**: Font stack: Inter, system-ui, sans-serif
   - Sizes: xs(12px), sm(14px), base(16px), lg(18px), xl(20px), 2xl(24px)

4. **Shadows**: Only degen-500 glow for emphasis
   - `shadow-[0_0_20px_rgba(0,255,65,0.3)]` for logo/hero
   - `shadow-[0_0_14px_rgba(0,255,65,0.25)]` for cards

5. **Dark Theme**: This is a dark-first design
   - Background: gray-950 (#030712)
   - Surface: gray-900 (#111827) with white/5 border
   - Text: white, gray-400, gray-500
   - No light mode yet — dark only

6. **Components**: Use shadcn-vue for Vue, Radix primitives as fallback
   - Cards: `.card` class (rounded-2xl, border white/5, bg-white/[0.02])
   - Buttons: `.btn-primary` (degen-500 bg, black text)
   - Inputs: `.input` (bg-transparent, white/10 border)

7. **Accessibility**: Always run axe-core after building
   - Buttons need `type="button"`
   - Images need `alt` text
   - Form inputs need labels
   - Modals need focus traps
