import { Select, Text, tokens } from "@fluentui/react-components";
import type { SelectOption } from "./LabeledCombobox";

interface LabeledSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export const LabeledSelect = ({ label, value, options, onChange }: LabeledSelectProps): JSX.Element => (
  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{label}</Text>
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </Select>
  </div>
);
