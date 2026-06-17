---
name: 3dxpert-printer-format-expert
description: "Authoritative knowledge base for 3DXpert printer integrations, output formats, SDK workflows, OEM processing, Slicer Viewer behavior, validation coverage and MeltControl support. Use when answering questions about: which file format a specific printer outputs, who owns slicing/hatching/laser assignment for a given workflow, whether MeltControl is supported, how FileNaming.xml behaves, Slicer Viewer display behavior per workflow, automation test coverage, and lifecycle status of any integration. Source of truth for Aconity, Renishaw, EOS, 3D Systems, Nikon SLM, Trumpf, Concept Laser, Additive Industries, DMG Mori, Farsoon, Eplus 3D, HP, and more."
metadata:
  author: lior.goldshtok@oqton.com
  version: '1.1'
---

# 3DXpert Printer & Format Expert

## When to Use This Skill

Load this skill whenever a question involves:

- What output format a 3DXpert printer integration produces (ILT, MTT, SLI, LMG, FAB3, WZA, CLS, EPI, SLM, CLI, BPX, BPZ, SLADDD, etc.)
- Who performs slicing, hatching, and laser assignment (3DXpert vs. OEM software vs. SDK)
- MeltControl support status per brand/format
- Slicer Viewer display behavior (full hatching vs. C0 only vs. not used)
- FileNaming.xml applicability
- Lifecycle status: Active, Planned, Archive, Legacy, Review Required
- Automation coverage and test scenarios
- Conflicts and unresolved open questions about specific brands
- Concept Laser / Colibrium FileNaming.xml suffix behavior

## Core Principles

1. **Always use the Authoritative Workflows table as the primary source of truth.**
2. **Do not present Planned / Future, Archive / Legacy, or Unconfirmed entries as active.**
3. **When confidence is "Unconfirmed", state clearly that the status is not confirmed.**
4. **MeltControl is only supported for: LMG (3D Systems DMP), EOS TPAPI, and Nikon SLM.**
5. **A ZIP container may contain different inner payloads — distinguish outer format from inner content.**
6. **NR in validation means "Not Required", not a failure.**

---

## Authoritative Workflows (Active)

### Aconity 3D — ILT Native
- **Output:** ILT
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** Aconity Studio
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported
- **FileNaming.xml:** No
- **Scope:** All Aconity printers. nLight variant adds extra laser parameters without changing the workflow.
- **Note:** Final laser assignment is performed in Aconity Studio.

### Renishaw — Native MTT
- **Output:** MTT
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** QuantAM
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported
- **FileNaming.xml:** No
- **Note:** Laser assignment is performed in QuantAM.

### Renishaw — SDK MTT
- **Output:** MTT (SDK output)
- **Slicing:** 3DXpert (geometry input) | **Hatching:** Renishaw SDK | **Laser Assignment:** QuantAM
- **Slicer Viewer:** C0 only (SDK calculates hatching; viewer shows only C0)
- **MeltControl:** Not Supported
- **FileNaming.xml:** No

### Renishaw — SDK RENAM
- **Output:** RENAM
- **Slicing:** 3DXpert (geometry input) | **Hatching:** Renishaw SDK | **Laser Assignment:** QuantAM
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported
- **Scope:** RenAM 500Q only. RENAM replaces MTT in this workflow — it is NOT an additional parallel output.

### GF (Georg Fischer) — EOS-like SLI
- **Output:** SLI
- **Slicing:** 3DXpert | **Hatching:** OEM software | **Laser Assignment:** OEM software
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported
- **Scope:** AM S 290 Tooling. Behavior is EOS SLI-like; brand remains GF.

### 3D Systems — LMG (DMP family)
- **Output:** LMG
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** 3DXpert
- **Slicer Viewer:** Full hatching
- **MeltControl:** ✅ Supported (Full)
- **FileNaming.xml:** No
- **Scope:** All LMG printers, single and multi-laser. Only LMG in the DMP family supports MeltControl.

### 3D Systems — FAB3
- **Output:** FAB3 (packed FAB3 containing build and scanpath data)
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** Not Applicable
- **Slicer Viewer:** Full hatching
- **OEM Next Step:** LayerViewer (view/validation only — does NOT perform laser assignment)
- **MeltControl:** Not Supported
- **Scope:** Current FAB3 printers are single-laser.

### EOS — SLI Native
- **Output:** SLI
- **Slicing:** 3DXpert | **Hatching:** EOSPRINT | **Laser Assignment:** EOSPRINT
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported
- **FileNaming.xml:** ✅ Yes — affects technology/component names inside output.

### EOS — SDK openjz
- **Output:** openjz (passes through EOSPRINT)
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** EOS SDK
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported
- **FileNaming.xml:** No
- **Note:** Must pass through EOSPRINT before use.

### EOS — SDK task
- **Output:** task (can go directly to machine)
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** EOS SDK
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported
- **Note:** Regular SDK task differs from TPAPI task — SDK performs laser assignment here; in TPAPI it is 3DXpert.

### EOS — TPAPI task
- **Output:** task (direct machine task)
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** 3DXpert
- **Slicer Viewer:** Full hatching
- **OEM Next Step:** Direct to machine; EOSPRINT not required
- **MeltControl:** ✅ Supported (Full)
- **Note:** All information is created in 3DXpert; EOSPRINT not required.

### Colibrium / Concept Laser — CLS Enhanced-C0
- **Output:** CLS (C0 + up to 4 contours + hatch boundary + optional islands)
- **Slicing:** 3DXpert | **Hatching:** OEM software (CL WRX, final) | **Laser Assignment:** OEM software
- **Slicer Viewer:** C0, up to 4 contours, boundary, optional islands — NOT final hatch
- **MeltControl:** Not Supported
- **FileNaming.xml:** Backward-compatibility use only — preserves pre-change output naming behavior requested by a customer.
- **Note:** CL WRX performs final hatching and laser assignment.

### Additive Industries — ZIP/BIN
- **Output:** ZIP (containing BIN files)
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** External laser-assignment tool
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported
- **Note:** BIN files already contain full hatching. Exact relationship between AI Preprocessor and Dynamic Laser Assignment Application is unresolved — do not claim the relationship or hatching changes beyond what is stated.

### 3D Systems SLS — BPX Native
- **Output:** BPX
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** Not Applicable / OEM-specific
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported
- **Scope:** SLS 380 and ProX SLS 6100.

### 3D Systems SLS — BPZ SDK
- **Output:** BPZ (SDK output)
- **Slicing:** SDK workflow | **Hatching:** SDK workflow | **Laser Assignment:** SDK/OEM
- **Slicer Viewer:** Not used
- **OEM Next Step:** 3D Sprint / SDK workflow
- **MeltControl:** Not Supported
- **Scope:** SLS 380 and ProX SLS 6100.

### 3D Systems SLS — SLS 6100 CLI
- **Output:** CLI (C0 for all layers)
- **Slicing:** 3DXpert | **Hatching:** Not in 3DXpert | **Laser Assignment:** Not Applicable / OEM-specific
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported
- **Scope:** ProX SLS 6100 optional workflow. CLI output contains C0 of every layer.

### 3D Systems SLA — SLADDD SDK
- **Output:** SLADDD (SDK output)
- **Slicing:** Not in 3DXpert | **Hatching:** SDK | **Laser Assignment:** SDK/OEM
- **Slicer Viewer:** Not used
- **MeltControl:** Not Supported
- **Note:** No slicing in 3DXpert; SDK creates SLADDD. SLA printer is created only through SDK.

### Nikon SLM — SLM
- **Output:** SLM
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** Configurable (3DXpert, configuration-dependent)
- **Slicer Viewer:** Full hatching
- **MeltControl:** ✅ Supported (Full) — depends on printer configuration
- **FileNaming.xml:** No
- **Note:** Laser assignment in 3DXpert is optional and configuration-dependent.

### Amaero — CLI Binary C0
- **Output:** CLI Binary
- **Slicing:** 3DXpert | **Hatching:** OEM software | **Laser Assignment:** OEM software / unknown
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported
- **Note:** OEM software name is unknown.

### Atlix / Trumpf — Native WZA
- **Output:** WZA (v3 or v5 as applicable)
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** TruTops Print
- **Slicer Viewer:** Full hatching
- **OEM Next Step:** TruTops Print
- **MeltControl:** Not Supported
- **FileNaming.xml:** Historical / no longer used.

### Atlix / Trumpf — SDK WZA
- **Output:** WZA (SDK output)
- **Slicing:** 3DXpert (geometry/input) | **Hatching:** Trumpf SDK | **Laser Assignment:** TruTops Print
- **Slicer Viewer:** Not used
- **MeltControl:** Not Supported
- **Note:** SDK creates hatching and WZA; 3DXpert Slicer Viewer not used.

### Techgine 3D — CLI Binary
- **Output:** CLI Binary
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** OEM software (unknown name)
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported

### Xact Metal — ZIP / CLI Binary
- **Output:** ZIP (containing CLI Binary)
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** 3DXpert
- **Slicer Viewer:** Full hatching
- **MeltControl:** Not Supported
- **Note:** 3DXpert performs laser assignment as well.

### DMG Mori — CLI (current supported workflow)
- **Output:** CLI
- **Slicing:** 3DXpert | **Hatching:** Celos | **Laser Assignment:** Celos
- **Slicer Viewer:** C0 only
- **OEM Next Step:** Celos
- **MeltControl:** Not Supported
- **FileNaming.xml:** ✅ Yes — affects technology/component names inside CLI.

### Farsoon — STL Geometry Export
- **Output:** STL (geometry only)
- **Slicing:** 3DXpert export only | **Hatching:** OEM software | **Laser Assignment:** OEM software
- **Slicer Viewer:** Not used
- **MeltControl:** Not Supported
- **Note:** All slicing and hatching are performed in OEM software; no scanpath in 3DXpert.

### Eplus 3D — EPI
- **Output:** EPI
- **Slicing:** 3DXpert | **Hatching:** 3DXpert | **Laser Assignment:** EPHatch
- **Slicer Viewer:** Full hatching
- **MeltControl:** In Development (no committed version)
- **OEM Next Step:** EPHatch
- **Note:** Current laser assignment is performed in EPHatch. Full information transfer being developed.

### HP — 3MF Geometry Export
- **Output:** 3MF (geometry only)
- **Slicing:** 3DXpert export only | **Hatching:** Not in 3DXpert | **Laser Assignment:** Not Applicable / OEM
- **Slicer Viewer:** Not used
- **MeltControl:** Not Supported
- **Note:** Geometry export only; no slicing and no scanpath in 3DXpert.

### Riton — CLI C0
- **Output:** CLI
- **Slicing:** 3DXpert | **Hatching:** OEM software (unknown name) | **Laser Assignment:** OEM software
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported
- **FileNaming.xml:** ✅ Yes (active).

### Generic / My Printer — CLI ASCII
- **Output:** CLI ASCII
- **Slicing:** 3DXpert | **Hatching:** Not in 3DXpert | **Laser Assignment:** Not Applicable
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported

### Generic / My Printer — SLC
- **Output:** SLC
- **Slicing:** 3DXpert | **Hatching:** Not in 3DXpert | **Laser Assignment:** Not Applicable
- **Slicer Viewer:** C0 only
- **MeltControl:** Not Supported

---

## Planned / Future (Do NOT present as active)

| Brand | Workflow | Status | Notes |
|---|---|---|---|
| OmniTek / OmniSint | ZIP / DXF | Planned / In Development | Not usable yet; under development |
| Nikon SLM | SLMX | Planned / Future | Not expected before end of 2027 |
| DMG Mori | DMG Native | Planned / Future | Workflow does not exist yet |
| AddUp | TBD | Planned for 26.3 | Not active yet |

---

## Archive & Legacy (Do NOT present as active)

| Brand | Workflow | Status | Notes |
|---|---|---|---|
| AMPro | ZIP / CLI per component | Archive / Inactive | No longer in use |
| FreeMelt | 3MFSTK (3MF with C0 contours) | Archive / Inactive | No longer in use |
| DiMetal / Syndaya | SND (CLI Binary) | Legacy / Plug-in Only | Not officially supported; requires special plug-in via Netfabb |

---

## Unconfirmed / Review Required (Do NOT present as active)

| Brand | Notes |
|---|---|
| Ureal 3D Printing Tech | Old Chinese CLI Binary format; current status not confirmed |
| Yongnian Laser Forming Tech | Old Chinese CLI Binary format; current status not confirmed |
| BLT | No confirmed current status; do not present as active or planned |

---

## User-Confirmed Rules

### MeltControl
- **Supported formats: LMG (3D Systems DMP), EOS TPAPI task, Nikon SLM only.**
- EOS TPAPI task: in progress (MC-Bug: delays in first stripes of a layer).
- Nikon SLM: in progress (MC-Bug: limitations due to old file format — lower resolution for power changes, doubling build time).
- Eplus 3D EPI: in development, no committed version.

### EOS SDK
- Regular SDK output can be **openjz** or **task**.
- openjz must pass through EOSPRINT.
- task can go directly to machine.

### EOS TPAPI
- Output is always **task**.
- Slicing, hatching, and laser assignment are all in 3DXpert.
- EOSPRINT is NOT required.

### Renishaw SDK
- SDK calculates hatching; 3DXpert viewer shows only C0.
- RENAM replaces MTT only for RenAM 500Q in the applicable SDK route.

### Concept Laser
- 3DXpert shows enhanced C0 representation (C0 + up to 4 contours + boundary + optional islands).
- Final hatching and laser assignment are performed in CL WRX.
- FileNaming.xml for Concept Laser: preserves backward-compatible output naming. In version 24.1 a new suffix feature was introduced; users who want the pre-24.1 behavior can remove suffixes from FileNaming.xml. Wall supports retain the "s_" prefix.

### Output Containers
- **Additive Industries:** ZIP containing BIN files.
- **Xact Metal:** ZIP containing CLI Binary.

### Lifecycle
- DMG Native, SLMX (Nikon), AddUp, and OmniTek are **not active**.
- FreeMelt and AMPro are **archived**.
- DiMetal/Syndaya is **legacy plug-in only**.

### Validation
- **NR = Not Required** (not a failure).

### FileNaming.xml
- **Active for:** EOS SLI, DMG CLI, Riton CLI.
- **Backward-compatibility use:** Concept Laser CLS.
- **Historical / not used:** Trumpf WZA.

### Slicer Viewer Rule
- Full hatching visible: native hatch workflows (Aconity, Renishaw native, 3D Systems LMG, EOS SDK openjz/task/TPAPI, Additive Industries, SLS BPX, Nikon SLM, Techgine, Xact Metal, Eplus 3D EPI, Trumpf native, 3D Systems FAB3).
- C0 only: EOS SLI native, Renishaw SDK, GF SLI, DMG CLI, Amaero, Riton, 3D Systems SLS 6100 CLI, Generic CLI ASCII, Generic SLC.
- Not used: Trumpf SDK WZA, 3D Systems BPZ SDK, 3D Systems SLADDD SDK, Farsoon STL, HP 3MF.

---

## Open Conflicts (Non-blocking)

| Entity | Unresolved Question | Operational Rule |
|---|---|---|
| Additive Industries | Exact relationship between AI Preprocessor and Dynamic Laser Assignment Application; whether external tool modifies hatching | Do not claim the relationship or hatching changes |
| Riton | Name of OEM software | Use OEM Software = Unknown |
| Techgine 3D | Name of OEM software | Use OEM Software = Unknown |
| Amaero | Name of OEM software; exact laser-assignment behavior | Use OEM Software = Unknown |
| Xact Metal | Name of OEM software used for viewing/validation | Use OEM Software = Unknown |

---

## Concept Laser FileNaming.xml — Reference XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<FileNamings>
  <TechnologySuffixes>
    <Map Technology="Multi Exposure Support" To="Multi Exposure Support"/>
    <Map Technology="Machining Offset" To="Machining Offset"/>
    <Map Technology="Solid Infill" To="Solid Infill"/>
    <Map Technology="Conformal Infill" To="Conformal Infill"/>
    <Map Technology="Part" To=""/>
    <Map Technology="Part Rough" To="Part Rough"/>
    <Map Technology="Part Fine" To="Part Fine"/>
    <Map Technology="Skirt Support" To="Skirt Support"/>
    <Map Technology="Lattice Support" To="Lattice Support"/>
    <Map Technology="Lattice" To="Lattice"/>
    <Map Technology="Surface Lattice" To="Surface Lattice"/>
    <Map Technology="Cone Support" To="Cone Support"/>
    <Map Technology="Solid Support" To="Solid Support"/>
    <Map Technology="Wall Support" To=""/>
    <Map Technology="Wall Infill" To="Wall Infill"/>
    <Map Technology="Solid Wall Support" To="Solid Wall Support"/>
    <Map Technology="Text" To="Text"/>
  </TechnologySuffixes>
</FileNamings>
```

---

## Automation Test Coverage

Key test scenarios and their coverage areas:

| Scenario | Slicer Test | Send2Print | Print Estimation | Build Style/Verify | Verifier TextFlag |
|---|---|---|---|---|---|
| ConstantV-LMG | No | Yes | No | No | No |
| Laser Off Segments | Yes | Yes | No | No | Yes |
| Print Estimation | No | No | Yes | No | No |
| Slicer Customers1/2/3 (+ MH variants) | Yes | No | No | No | Yes |
| Slicer Formats / VMs | Yes | No | No | No | Yes |
| Slicer Validated / EOS / MH | Yes | No | No | No | Yes |
| Slicer Within / MH / BigFiles variants | Yes | No | No | No | Yes |
| Slicer_ImplicitLattice / SuperBox | Yes | No | No | No | Yes |
| Slicer Verifier | No | No | No | Yes | Yes |
| SendToPrint_Within / Within2 | No | Yes | Yes | No | No |
| ImportExport BuildStyle | No | No | No | Yes | No |
| Test Plate | No | No | No | Yes | No |
| Slicer Performance | Yes | No | No | No | Yes |
| Recalculate Parameters | No | No | No | No | No |
| Force Master Build | No | No | No | No | No |
| Slicer System / MH / BigFiles variants | No | No | No | No | No |
| Slicer Orthus | No | No | No | No | No |

---

## Data Dictionary

| Field | Meaning | AI Guidance |
|---|---|---|
| Declared Output Extension | Value recorded in the printer-level source | Do not assume it equals the internal payload format |
| Logical/Internal Format | 3DXpert format identifier or internal payload type | Use together with Container/Packaging |
| Container/Packaging | Outer package (ZIP, packed FAB3) | A ZIP may contain CLI, DXF, or another format |
| Scanpath Base | Original implementation class: Hatch Base, C0 Base, SDK, SDK Template, No Scanpath | Use Workflow Type for normalized querying |
| Workflow Type | Normalized workflow classification | Preferred retrieval filter |
| Validation Result | Original test-round status | NR = Not Required; not a failure |
| AI Confidence | High / Medium / Source 1 only / Needs review | Avoid definitive operational answers from Needs review rows |
