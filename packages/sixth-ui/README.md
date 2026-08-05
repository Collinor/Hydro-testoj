# Sixth UI

`@hydrooj/sixth-ui` is the isolated hexagonal interface package for SixthOJ. It keeps Hydro's routes, permissions, data contracts, and translations while supplying its own theme configuration, homepage composition, and responsive presentation layer.

## Configuration

The system settings page exposes `sixth-ui.brand`, `sixth-ui.palette`, `sixth-ui.allowUserPalette`, and the optional `sixth-ui.customBackground`, `sixth-ui.customTheme`, `sixth-ui.customTitle`, `sixth-ui.customText`, and `sixth-ui.customAccent` color overrides. Empty custom color values inherit from the selected preset.

The `cheese` preset is defined in `presets.ts`. Add future presets there so component styles continue to consume semantic CSS properties instead of direct color values.

## User palette API

When `sixth-ui.allowUserPalette` is enabled, integrations can call `window.SixthUI.applyPalette(colors, true)` to validate and save browser-local overrides. `window.SixthUI.resetPalette()` removes them and restores the server palette.

The supported color keys are `background`, `theme`, `title`, `text`, and `accent`.
