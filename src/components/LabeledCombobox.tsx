import { Combobox, Option, Text, tokens } from "@fluentui/react-components";

export interface SelectOption {
  value: string;
  label: string;
}

interface LabeledComboboxProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export const LabeledCombobox = ({ label, value, options, onChange }: LabeledComboboxProps): JSX.Element => (
  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{label}</Text>
    <Combobox
      selectedOptions={[value]}
      value={value}
      onOptionSelect={(_, data) => {
        if (data.optionValue !== undefined) onChange(data.optionValue);
      }}
    >
      {options.map((option) => (
        <Option key={option.value} value={option.value}>{option.label}</Option>
      ))}
    </Combobox>
  </div>
);
