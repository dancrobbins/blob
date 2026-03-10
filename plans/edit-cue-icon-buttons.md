---
name: Edit cue icon buttons
overview: Replace the current div-based edit cues with icon-based buttons using the 10 Variant Recording icons from the guide, extend the EditSource type and tooltip copy to match the new states, and optionally add logic for Ready/Not Ready/Recording and the two combo states (contains-temporary, recorded-contains-temporary).
todos: []
isProject: false
---

# New edit cue icon buttons (Variant Recording guide)

## Mapping (from your chart)


| Icon name                           | State description (new tooltip)                                                                      | Previous tooltip (current code)                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Variant_Ready                       | Ready to record                                                                                      | new state                                                            |
| Variant_Not_Ready                   | Nothing ready to record                                                                              | new state                                                            |
| Variant_Recording                   | Recording                                                                                            | new state                                                            |
| Variant_Contains                    | Has recorded variant selections                                                                      | node owns a variant set → **wrapper**                                |
| Variant_Recorded_Contains           | Has recorded variant selections and object edits                                                     | Owns variant set with opinions → **wrapper+variant**                 |
| Variant_Recorded                    | Has recorded object edits                                                                            | variant opinion captured → **variant**                               |
| Variant_Temporary                   | Temporary edits ready to record                                                                      | temporary change (not captured) → **temp**                           |
| Variant_Recorded_Temporary          | Has recorded object edits and ready to record temporary edits                                        | temporary edit made on top of an existing variant → **variant+temp** |
| Variant_Contains_Temporary          | Has recorded variant selections and is ready to record temporary edits                               | new state                                                            |
| Variant_Recorded_Contains_Temporary | Has recorded variant selections and is ready to record temporary edits and has recorded object edits | new state                                                            |


All 10 icons already exist in the codebase: [src/assets/icons/index.ts](src/assets/icons/index.ts) exports `VariantReady`, `VariantNotReady`, `VariantRecording`, `VariantContains`, `VariantRecordedContains`, `VariantRecorded`, `VariantTemporary`, `VariantRecordedTemporary`, `VariantContainsTemporary`, `VariantRecordedContainsTemporary`.

---

## 1. Extend EditSource and add icon/tooltip mapping

- **Type**
Extend `EditSource` in [src/project/panels/propertyPanelEditCue.tsx](src/project/panels/propertyPanelEditCue.tsx) to include the five new states so the type matches the 10 icon states:
  - Add: `"ready" | "not-ready" | "recording" | "contains-temporary" | "recorded-contains-temporary"`.
  - Keep existing: `"variant" | "temp" | "variant+temp" | "wrapper" | "wrapper+variant" | "empty"` for backward compatibility during the transition (or rename to the new names and map at the useEditCues boundary; see below).
- **Central mapping (recommended)**
Add a small shared module (e.g. under `src/project/panels/` or `src/components/SceneTreePanel/`) that:
  - Maps each `EditSource` value to the correct icon component (from `@/assets/icons`) and to the new tooltip string from the chart (e.g. `VariantRecorded` → "Has recorded object edits", `Variant_Recorded_Contains_Temporary` → the long description).
  - If we keep the six legacy names in the type, this layer maps: `variant` → VariantRecorded, `temp` → VariantTemporary, `wrapper` → VariantContains, `wrapper+variant` → VariantRecordedContains, `variant+temp` → VariantRecordedTemporary. `empty` can map to VariantNotReady or a neutral icon if desired.
- **Tooltip copy**
Replace the existing `EDIT_CUE_LEGEND` strings in [src/components/SceneTreePanel/SceneTreeView.tsx](src/components/SceneTreePanel/SceneTreeView.tsx) (lines 608–614) with the new state descriptions from the chart for all 10 states. Use the same mapping module so tooltip text stays in one place.

---

## 2. Shared EditCue button component

- **Component**
Create a single reusable component (e.g. `EditCueButton` or `VariantRecordingCue`) that:
  - Accepts `editSource: EditSource` (extended type) and optional `size` (from `SpectrumSizeContext`).
  - Renders the correct icon from the mapping (using the 10 `Variant`* components from `@/assets/icons`).
  - Wraps the icon in a Spectrum 2 **ActionButton** (`isQuiet`, icon-only, `aria-label` from the same tooltip string) so it matches the "special version of the Spectrum 2 Action button" you want. Use the same pattern as the existing Lock/Visibility/Isolate buttons in [SceneTreeView.tsx](src/components/SceneTreePanel/SceneTreeView.tsx) (e.g. around 1094–1116): `size={spectrumSize}`, `isQuiet`, `staticColor` for contrast on dark background.
  - If the cue is non-interactive (display-only), it can render as a span with the icon and a tooltip; otherwise use `ActionButton` with `onPress` no-op or a future handler.
- **Placement**
Use this component from:
  - **Outliner rail:** [SceneTreePanel.tsx](src/components/SceneTreePanel/SceneTreePanel.tsx) `renderEditCue` (lines 249–275) and, if still used, [SceneTreeView.tsx](src/components/SceneTreePanel/SceneTreeView.tsx) `EditCueRailCell` (around 568–601) and any inline `SceneTreeEditCue` usage (e.g. variant rows).
  - **Property panel:** [propertyPanelEditCue.tsx](src/project/panels/propertyPanelEditCue.tsx) `EditCue` (replace the current div-based rendering with this component).

---

## 3. useEditCues: keep current output, optional new states

- **Minimal change (recommended for "start making")**
Leave [useEditCues.ts](src/project/hooks/useEditCues.ts) returning the same six `EditSource` values. The new shared component's mapping layer translates those six to the six corresponding icons (Recorded, Temporary, RecordedTemporary, Contains, RecordedContains) and tooltips. No change to `editedNodeSources`, `activeVariantSetCues`, or `variantOpinionCues` logic.
- **Optional later:**
  - **Ready / Not ready / Recording**
  useEditCues does not currently receive "is any set armed?" or "which row is recording?". To show Variant_Ready, Variant_Not_Ready, or Variant_Recording, extend `UseEditCuesConfig` with e.g. `recordingVariantSetIds?: Set<string>` and optionally `recordingNodeId?: string | null`, and in the code that builds `editedNodeSources` (or a separate map used only for the rail), set `"ready"` / `"not-ready"` / `"recording"` for the appropriate rows. Callers (e.g. StarterTemplate) already have access to `variantSets` and `recordingVariantName`; they can pass a derived set of "armed" set IDs and, if defined, the node ID that is "currently recording" for the orange dot.
  - **Contains-temporary and recorded-contains-temporary**
  Add logic in the same `editedNodeSources` (and, if needed, `activeVariantSetCues`) useMemo: when a node is currently `wrapper` and has temporary edits in context (e.g. pending edits on selected node that would apply under this set), output `"contains-temporary"`; when it is `wrapper+variant` and has temporary deviations, output `"recorded-contains-temporary"`. This may require passing `pendingEdits` and/or selected node into the wrapper/variant+temp branch so we can detect "ready to record temporary" on the wrapper.

---

## 4. Layout and constants

- **Rail width**
The current cue is 8px wide ([EDIT_CUE_WIDTH](src/components/SceneTreePanel/sceneTreeConstants.ts) and [propertyPanelEditCue](src/project/panels/propertyPanelEditCue.tsx)). Icon buttons are typically 24px (M) or 20px (S). Update [sceneTreeConstants.ts](src/components/SceneTreePanel/sceneTreeConstants.ts): `EDIT_CUE_WIDTH` and/or `OUTLINER_EDIT_RAIL_WIDTH` so the pinned edit column fits the new button (e.g. 24 or 32px). Adjust any `paddingRight` or selection `right` offsets that depend on the rail (e.g. in [SceneTreeView.tsx](src/components/SceneTreePanel/SceneTreeView.tsx) TreeRow and inline variant rows) so the selection highlight and layout still align.
- **Property panel**
In [propertyPanelEditCue.tsx](src/project/panels/propertyPanelEditCue.tsx), `getPropertyRowWrapperStyle` uses `EDIT_CUE_WIDTH + EDIT_CUE_GAP`. Increase `EDIT_CUE_WIDTH` (or use a separate constant for the button size) so the reserved width fits the icon button.

---

## 5. Remove old cue UI and wire tooltip

- **SceneTreeView**
Remove or replace the div-based `SceneTreeEditCue` (lines 448–562) with the new shared component. Replace the inline `EDIT_CUE_LEGEND` with the 10-state legend using the new tooltip strings; keep `EditCueTooltip` but drive it from the shared mapping (so one source of truth for labels). `EditCueRailCell` should render the new button component and the same tooltip behavior (e.g. hover to show legend).
- **SceneTreePanel**
Replace the inline `renderEditCue` divs (249–275) with the shared EditCue button component.
- **VariantSwitcherSection / FavoriteVariantsBar / VariantsPanel**
Any place that still renders an edit cue (e.g. active variant set cue) should use the same shared component and mapping so icons and tooltips stay consistent.

---

## 6. Testing and accessibility

- Ensure each edit cue button has an `aria-label` equal to the tooltip text for that state.
- If the button is interactive later (e.g. click to open a menu), keep keyboard and focus behavior consistent with other ActionButtons in the tree.
- Run `pnpm lint` and `pnpm build` after changes; fix any new type errors (e.g. `EditSource` extended type used in useEditCues return and all consumers).

---

## Summary


| Step | Action                                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Extend `EditSource` with 5 new states; add shared mapping (EditSource → icon component + tooltip string).                                                                  |
| 2    | Create shared `EditCueButton` (or similar) using S2 ActionButton + icon from mapping; use in Outliner rail and property panel.                                             |
| 3    | Leave useEditCues returning current 6 values; mapping layer turns them into the 6 matching icons. Optionally add Ready/Not ready/Recording and the two combo states later. |
| 4    | Update `EDIT_CUE_WIDTH` / `OUTLINER_EDIT_RAIL_WIDTH` and property row padding for icon-button size.                                                                        |
| 5    | Replace all div-based cue UIs with the new component; update EDIT_CUE_LEGEND to 10 states with new tooltip copy.                                                           |
| 6    | Lint, build, and accessibility check.                                                                                                                                      |
