interface Props {
  checked: boolean;
  onChange: () => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      className={`toggle${checked ? " toggle--on" : ""}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "toggle"}
    />
  );
}
