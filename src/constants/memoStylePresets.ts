/** メモスタイルのプリセット定義。 */
export type MemoStylePreset = {
  id: string;
  label: string;
  instruction: string;
};

// LLMに渡すスタイル指示の一覧。
export const memoStylePresets: MemoStylePreset[] = [
  {
    "id": "none",
    "label": "None",
    "instruction": ""
  },
  {
    id: "structured_minutes",
    label: "Structured minutes",
    instruction:
      "Keep structure clear. Emphasize points, decisions, action items, and open questions.",
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    instruction:
      "Group related ideas, highlight hypotheses, and list next experiments or checks.",
  },
  {
    id: "tech_notes",
    label: "Tech notes",
    instruction:
      "Capture constraints, options, decisions, and risks in a concise technical style.",
  },
];
